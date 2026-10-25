import { FunctionNode, SymbolNode, type MathNode } from "mathjs";
import type { TacticPlugin } from "../types/tactic";
import { getChildren, isConst, isFn, isOp, mul, num, op } from "../engine/ast";
import { defineRules } from "../engine/defineRule";
import { TacticError } from "../engine/errors";
import { toLatex } from "../engine/latex";

/**
 * The rules of the number-theory lessons: whole numbers, their prime factors, and the greatest
 * common divisor and least common multiple of two of them. Each is one step a pupil writes as
 * one line. Arithmetic is one operation at a time, as in the engine this came from.
 */

export const CH3 = "Divisors and multiples";
const tex = (n: MathNode) => toLatex(n);

export const intOf = (n: MathNode): number | null =>
  isConst(n) && Number.isSafeInteger(n.value) && n.value >= 0 ? n.value : null;

export function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** The prime factorization of n, as [prime, exponent] in increasing order of the primes. */
export function factorize(n: number): [number, number][] {
  const out: [number, number][] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

/** Read a product of literal primes and powers of literal primes (2^2 · 3, 5, 1) as a map from
 * prime to exponent; null if it is anything else. */
export function primePowers(n: MathNode): Map<number, number> | null {
  const out = new Map<number, number>();
  const visit = (x: MathNode): boolean => {
    const v = intOf(x);
    if (v !== null) {
      if (v === 1) return true;
      if (!isPrime(v)) return false;
      out.set(v, (out.get(v) ?? 0) + 1);
      return true;
    }
    if (isOp(x, "pow")) {
      const b = intOf(x.args[0]);
      const e = intOf(x.args[1]);
      if (b === null || e === null || !isPrime(b) || e < 1) return false;
      out.set(b, (out.get(b) ?? 0) + e);
      return true;
    }
    if (isOp(x, "multiply")) return x.args.every(visit);
    return false;
  };
  return visit(n) ? out : null;
}

/** Build p^a · q^b · … in increasing order of the primes; the empty product is 1. */
export function primeProduct(m: Map<number, number>): MathNode {
  const terms = [...m.entries()]
    .filter(([, e]) => e > 0)
    .sort(([a], [b]) => a - b)
    .map(([p, e]) => (e === 1 ? num(p) : op("pow", [num(p), num(e)])));
  if (terms.length === 0) return num(1);
  return terms.slice(1).reduce((acc, t) => mul(acc, t), terms[0]);
}

const twoArgs = (n: MathNode, name: string): [MathNode, MathNode] | null =>
  isFn(n, name) && n.args.length === 2 ? [n.args[0], n.args[1]] : null;

const primeFactor: TacticPlugin = {
  id: "prime_factor",
  name: "Write as a product of primes",
  chapter: CH3,
  section: "Primes",
  category: "alu",
  direction: "forward",
  description: "Write a whole number as a product of powers of primes: 12 = 2² · 3.",
  ruleLatex: "12 = 2^{2} \\cdot 3",
  canApply: (node) => {
    const n = intOf(node);
    return n !== null && n >= 4 && !isPrime(n);
  },
  explainMismatch: (node) => {
    const n = intOf(node);
    if (n === null) return `Only a single whole number can be written as a product of primes; $${tex(node)}$ is not one.`;
    if (isPrime(n)) return `$${n}$ is a prime already: its only factors are $1$ and itself.`;
    return `$${n}$ has no prime factors to write out.`;
  },
  apply: (node) => primeProduct(new Map(factorize(intOf(node)!))),
};

const intFactor: TacticPlugin = {
  id: "int_factor",
  name: "Split into two factors",
  chapter: CH3,
  section: "Primes",
  category: "alu",
  direction: "forward",
  description: "Write a whole number as a product of two smaller whole numbers: 12 = 4 · 3.",
  ruleLatex: "n = p \\cdot q",
  paramSchema: { type: "factors", prompt: "Which two factors of {n}?" },
  canApply: (node) => {
    const n = intOf(node);
    return n !== null && n >= 4 && !isPrime(n);
  },
  validateParams: (node, params) => {
    const p = Number(params?.p);
    const q = Number(params?.q);
    if (!Number.isInteger(p) || !Number.isInteger(q) || p < 2 || q < 2) return "Give two whole numbers, each at least 2.";
    return p * q === intOf(node) ? null : `$${p} \\cdot ${q} = ${p * q}$, not $${intOf(node)}$.`;
  },
  apply: (node, params) => {
    const p = Number(params?.p);
    const q = Number(params?.q);
    if (p * q !== intOf(node)) throw new TacticError("Those factors do not multiply to the number.");
    return mul(num(p), num(q));
  },
};

const collect: TacticPlugin = {
  id: "pow_collect",
  name: "Equal factors into a power",
  chapter: CH3,
  section: "Powers",
  category: "axiom",
  direction: "forward",
  description: "A number written twice as a factor is its square; a power times its base is the next power: 2 · 2 = 2², 2² · 2 = 2³.",
  ruleLatex: "a \\cdot a = a^{2}, \\quad a^{m} \\cdot a = a^{m+1}, \\quad a^{m} \\cdot a^{n} = a^{m+n}",
  canApply: (node) => {
    if (!isOp(node, "multiply") || node.args.length !== 2) return false;
    const [l, r] = node.args;
    const base = (x: MathNode) => (isOp(x, "pow") ? intOf(x.args[0]) : intOf(x));
    const exp = (x: MathNode) => (isOp(x, "pow") ? intOf(x.args[1]) : 1);
    return base(l) !== null && base(l) === base(r) && exp(l) !== null && exp(r) !== null;
  },
  apply: (node) => {
    const [l, r] = getChildren(node);
    const base = isOp(l, "pow") ? intOf(l.args[0])! : intOf(l)!;
    const e = (isOp(l, "pow") ? intOf(l.args[1])! : 1) + (isOp(r, "pow") ? intOf(r.args[1])! : 1);
    return op("pow", [num(base), num(e)]);
  },
};

function bothFactored(name: string) {
  return (node: MathNode) => {
    const a = twoArgs(node, name);
    return !!a && primePowers(a[0]) !== null && primePowers(a[1]) !== null;
  };
}

function notFactored(name: string, what: string) {
  return (node: MathNode) => {
    const a = twoArgs(node, name);
    if (!a) return `This rule is for the ${what} of two numbers.`;
    const bad = a.filter((x) => primePowers(x) === null);
    return `Write ${bad.map((x) => `$${tex(x)}$`).join(" and ")} as a product of primes first.`;
  };
}

const lcmPowers: TacticPlugin = {
  id: "lcm_powers",
  name: "LCM: each prime to its highest power",
  chapter: CH3,
  section: "Least common multiples",
  category: "axiom",
  direction: "forward",
  description: "A multiple of both numbers must hold every prime of either, as many times as the one that has it most.",
  ruleLatex: "\\operatorname{lcm}(2^{2} \\cdot 3,\\, 2 \\cdot 3^{2}) = 2^{2} \\cdot 3^{2}",
  canApply: bothFactored("lcm"),
  explainMismatch: notFactored("lcm", "least common multiple"),
  apply: (node) => {
    const [a, b] = twoArgs(node, "lcm")!.map((x) => primePowers(x)!);
    const m = new Map(a);
    for (const [p, e] of b) m.set(p, Math.max(m.get(p) ?? 0, e));
    return primeProduct(m);
  },
};

const gcdPowers: TacticPlugin = {
  id: "gcd_powers",
  name: "GCD: the shared primes to their lowest power",
  chapter: CH3,
  section: "Greatest common divisors",
  category: "axiom",
  direction: "forward",
  description: "A divisor of both numbers can hold only the primes they share, and no more of each than the one that has it least.",
  ruleLatex: "\\gcd(2^{2} \\cdot 3,\\, 2 \\cdot 3^{2}) = 2 \\cdot 3",
  canApply: bothFactored("gcd"),
  explainMismatch: notFactored("gcd", "greatest common divisor"),
  apply: (node) => {
    const [a, b] = twoArgs(node, "gcd")!.map((x) => primePowers(x)!);
    const m = new Map<number, number>();
    for (const [p, e] of a) if (b.has(p)) m.set(p, Math.min(e, b.get(p)!));
    return primeProduct(m);
  },
};

const euclid: TacticPlugin = {
  id: "euclid",
  name: "Euclid's step",
  chapter: CH3,
  section: "Greatest common divisors",
  category: "axiom",
  direction: "forward",
  description: "Divide the greater of the two numbers by the less, and keep the divisor and the remainder: whatever divides both numbers divides the remainder too (Euler, Elements, §452–458).",
  ruleLatex: "\\gcd(576, 252) = \\gcd(252, 72) \\quad (576 = 2 \\cdot 252 + 72)",
  canApply: (node) => {
    const a = twoArgs(node, "gcd");
    if (!a) return false;
    const [x, y] = a.map(intOf);
    return x !== null && y !== null && x > 0 && y > 0;
  },
  explainMismatch: (node) => {
    const a = twoArgs(node, "gcd");
    if (!a) return "Euclid's step is for the greatest common divisor of two numbers.";
    const [x, y] = a.map(intOf);
    if (x === null || y === null) return "Euclid's step needs the two numbers written out as numbers.";
    return "Nothing is left to divide by: the rule for $0$ finishes it.";
  },
  // As Euler lays it out (§452, §460): whichever comes first, the greater is divided by the
  // less, and the line keeps the divisor and the remainder.
  apply: (node) => {
    const [x, y] = twoArgs(node, "gcd")!.map((v) => intOf(v)!);
    const [big, small] = x >= y ? [x, y] : [y, x];
    return fnNode("gcd", [num(small), num(big % small)]);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Fn = FunctionNode as any;
const fnNode = (name: string, args: MathNode[]): MathNode => new Fn(new SymbolNode(name), args) as MathNode;

const literalArithmetic: TacticPlugin[] = [
  {
    id: "mult_lit",
    name: "Multiply two numbers",
    chapter: CH3,
    section: "Arithmetic",
    category: "alu",
    direction: "forward",
    description: "Work out the product of two numbers: 4 · 9 = 36.",
    ruleLatex: "4 \\cdot 9 = 36",
    canApply: (node) => isOp(node, "multiply") && node.args.length === 2 && node.args.every((a) => intOf(a) !== null),
    apply: (node) => num(intOf(getChildren(node)[0])! * intOf(getChildren(node)[1])!),
  },
  {
    id: "pow_lit",
    name: "Work out a power",
    chapter: CH3,
    section: "Arithmetic",
    category: "alu",
    direction: "forward",
    description: "Multiply the base by itself as many times as the exponent says: 2³ = 8.",
    ruleLatex: "2^{3} = 8",
    canApply: (node) => {
      if (!isOp(node, "pow")) return false;
      const b = intOf(node.args[0]);
      const e = intOf(node.args[1]);
      return b !== null && e !== null && e >= 1 && b ** e <= 1e12;
    },
    apply: (node) => num(intOf(getChildren(node)[0])! ** intOf(getChildren(node)[1])!),
  },
  {
    id: "div_lit",
    name: "Divide exactly",
    chapter: CH3,
    section: "Arithmetic",
    category: "alu",
    direction: "forward",
    description: "Work out a quotient that comes out whole: 432 ÷ 6 = 72.",
    ruleLatex: "432 \\div 6 = 72",
    canApply: (node) => {
      if (!isOp(node, "divide")) return false;
      const a = intOf(node.args[0]);
      const b = intOf(node.args[1]);
      return a !== null && b !== null && b > 0 && a % b === 0;
    },
    explainMismatch: () => "That quotient does not come out whole.",
    apply: (node) => num(intOf(getChildren(node)[0])! / intOf(getChildren(node)[1])!),
  },
];

const gcdZero: TacticPlugin = {
  id: "gcd_zero",
  name: "The GCD with 0",
  chapter: CH3,
  section: "Greatest common divisors",
  category: "axiom",
  direction: "forward",
  description: "Every number divides 0, so the greatest common divisor of a and 0 is a itself.",
  ruleLatex: "\\gcd(a, 0) = a",
  canApply: (node) => {
    const a = twoArgs(node, "gcd");
    return !!a && intOf(a[1]) === 0;
  },
  apply: (node) => twoArgs(node, "gcd")![0].cloneDeep(),
};

export const rules: TacticPlugin[] = [
  primeFactor,
  intFactor,
  collect,
  lcmPowers,
  gcdPowers,
  euclid,
  gcdZero,
  ...literalArithmetic,
  ...defineRules([
    {
      id: "gcd_swap",
      name: "The order does not matter (GCD)",
      chapter: CH3,
      section: "Greatest common divisors",
      category: "axiom",
      description: "The greatest common divisor of a and b is that of b and a.",
      lhs: "gcd(a, b)",
      rhs: "gcd(b, a)",
    },
    {
      id: "lcm_swap",
      name: "The order does not matter (LCM)",
      chapter: CH3,
      section: "Least common multiples",
      category: "axiom",
      description: "The least common multiple of a and b is that of b and a.",
      lhs: "lcm(a, b)",
      rhs: "lcm(b, a)",
    },
    {
      id: "lcm_by_gcd",
      name: "LCM from the GCD",
      chapter: CH3,
      section: "The two together",
      category: "axiom",
      description: "The GCD and the LCM of two numbers multiply to the two numbers' product, so lcm(a, b) = ab ÷ gcd(a, b).",
      lhs: "lcm(a, b)",
      rhs: "(a * b) / gcd(a, b)",
    },
  ]),
];

/** Rules the hint search may use: splitting into two factors is a pupil's move, too wide to search. */
export const searchable = rules.filter((r) => r.id !== "int_factor");
