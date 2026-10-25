import { describe, expect, it } from "vitest";
import { parseProblem } from "../src/engine/parse";
import { structKey, isConst } from "../src/engine/ast";
import { rules, searchable, factorize, primePowers } from "../src/rules/numbertheory";
import { judge, intended, valueOf } from "../src/tutor/check";
import { masterMove } from "../src/tutor/school";
import { question, verdict } from "../src/tutor/voice";
import { LESSONS } from "../src/lessons/ch3";
import { solve } from "../src/engine/solver";
import { readLine } from "../src/latex/reader";

const P = (s: string) => parseProblem(s);
const rule = (id: string) => rules.find((r) => r.id === id)!;
const step = (id: string, s: string) => structKey(rule(id).apply(P(s)));

describe("the rules: one positive and one negative each", () => {
  it("writes a number as a product of primes, and refuses a prime", () => {
    expect(step("prime_factor", "12")).toBe(structKey(P("2^2 * 3")));
    expect(step("prime_factor", "1071")).toBe(structKey(P("3^2 * 7 * 17")));
    expect(rule("prime_factor").canApply(P("13"))).toBe(false);
    expect(rule("prime_factor").explainMismatch!(P("13"))).toContain("prime already");
  });
  it("the LCM takes each prime to its highest power; the GCD the shared ones to their lowest", () => {
    expect(step("lcm_powers", "lcm(2^2 * 3, 2 * 3^2)")).toBe(structKey(P("2^2 * 3^2")));
    expect(step("gcd_powers", "gcd(2^2 * 3, 2 * 3^2)")).toBe(structKey(P("2 * 3")));
    expect(step("gcd_powers", "gcd(17, 2 * 3 * 5)")).toBe(structKey(P("1")));
    expect(rule("lcm_powers").canApply(P("lcm(12, 2 * 3^2)"))).toBe(false);
    expect(rule("lcm_powers").explainMismatch!(P("lcm(12, 2 * 3^2)"))).toContain("as a product of primes first");
  });
  it("Euclid's step replaces the larger by the remainder; gcd(a, 0) = a", () => {
    expect(step("euclid", "gcd(84, 60)")).toBe(structKey(P("gcd(60, 24)")));
    expect(rule("euclid").canApply(P("gcd(60, 84)"))).toBe(false);
    expect(step("gcd_zero", "gcd(12, 0)")).toBe(structKey(P("12")));
    expect(rule("gcd_zero").canApply(P("gcd(0, 12)"))).toBe(false);
  });
  it("arithmetic is one operation at a time", () => {
    expect(step("mult_lit", "4 * 9")).toBe(structKey(P("36")));
    expect(rule("mult_lit").canApply(P("4 * 9 * 2"))).toBe(false);
    expect(step("pow_lit", "2^3")).toBe(structKey(P("8")));
    expect(rule("div_lit").canApply(P("7 / 2"))).toBe(false);
    expect(step("pow_collect", "2 * 2")).toBe(structKey(P("2^2")));
    expect(step("pow_collect", "2^2 * 2")).toBe(structKey(P("2^3")));
  });
  it("factorize and primePowers agree", () => {
    expect(factorize(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(primePowers(P("2^3 * 3^2 * 5"))).toEqual(new Map([[2, 3], [3, 2], [5, 1]]));
    expect(primePowers(P("4 * 3"))).toBe(null);
  });
});

describe("the judge", () => {
  const read = (prev: string, src: string) => {
    const r = readLine(src);
    if (!r.ok) throw new Error(JSON.stringify(r.notes));
    const n = intended(P(prev), r.node, r.lhs);
    if (n === "elsewhere") return { kind: "elsewhere" as const };
    return judge(P(prev), n, rules);
  };
  it("names the rule of a one-step line", () => {
    const v = read("lcm(12, 18)", "= \\operatorname{lcm}(2^{2} \\cdot 3, 18)");
    expect(v.kind).toBe("one");
    expect(v.kind === "one" && v.rule.id).toBe("prime_factor");
  });
  it("reads a side working, 12 = 2^2 · 3, as a rewrite of that part", () => {
    const v = read("lcm(12, 18)", "12 = 2^{2} \\cdot 3");
    expect(v.kind === "one" && v.rule.id).toBe("prime_factor");
  });
  it("says two steps are two, a true jump is true, and a wrong line is wrong", () => {
    expect(read("lcm(12, 18)", "\\operatorname{lcm}(2^{2} \\cdot 3, 2 \\cdot 3^{2})").kind).toBe("twice");   // one rule, both numbers
    expect(read("lcm(2^2 * 3, 18)", "2^{2} \\cdot 3^{2}").kind).toBe("two");
    expect(read("lcm(12, 18)", "36").kind).toBe("true");
    expect(read("lcm(12, 18)", "216").kind).toBe("false");
    expect(read("lcm(12, 18)", "24 = 2^{3} \\cdot 3").kind).toBe("elsewhere");
  });
  it("speaks a verdict in the school's words", () => {
    const v = read("lcm(2^2 * 3, 18)", "2^{2} \\cdot 3^{2}");
    expect(verdict(v, () => false).say).toContain("two steps in one line");
    expect(valueOf(P("lcm(12, 18)"))).toBe(36);
  });
});

describe("the school and the lessons", () => {
  it("every problem is solvable by the lesson's rules, and its goal is its value", () => {
    for (const l of LESSONS) {
      const ts = searchable.filter((r) => l.rules.includes(r.id));
      for (const pr of l.problems) {
        expect(valueOf(P(pr.start))).toBe(pr.goal);
        const goal = (n: ReturnType<typeof P>) => isConst(n) && n.value === pr.goal;
        expect(solve(P(pr.start), goal, ts, { maxDepth: 9, maxStates: 50_000 }), pr.id).not.toBe(null);
      }
    }
  });
  it("factors small numbers at sight and takes Euclid's way for large ones", () => {
    const l = LESSONS.find((x) => x.id === "euclid")!;
    const ts = searchable.filter((r) => l.rules.includes(r.id));
    const goal = (g: number) => (n: ReturnType<typeof P>) => isConst(n) && n.value === g;
    expect(masterMove(P("gcd(1071, 462)"), goal(21), ts)!.rule.id).toBe("euclid");
    expect(masterMove(P("gcd(84, 60)"), goal(12), ts)!.rule.id).toBe("prime_factor");
  });
  it("the question is pitched: an idea named, or a pointer", () => {
    expect(question("euclid", P("gcd(84, 60)"), false)).toContain("what is left when $84$ is divided by $60$");
    expect(question("euclid", P("gcd(84, 60)"), true)).toBe("The remainder of $84 \\div 60$.");
    for (const r of rules) expect(question(r.id, P("gcd(84, 60)"), false)).not.toBe("What is the next step?");
  });
});
