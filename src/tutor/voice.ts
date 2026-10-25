import type { MathNode } from "mathjs";
import { getChildren, isFn } from "../engine/ast";
import { toLatex } from "../engine/latex";
import type { Verdict } from "./check";

/**
 * What the school says: fixed sentences over what the line holds. No sentence is generated, and
 * none is put in Euler's mouth: the school asks, in its own words. `$…$` is mathematics.
 */

interface Forms {
  /** The question when the rule is new to him: it names the idea. */
  ask: string;
  /** A pointer, for a rule he owns. */
  nudge: string;
}

const T: Record<string, Forms> = {
  prime_factor: { ask: "Which primes multiply together to make $${n}$?", nudge: "Look at $${n}$." },
  int_factor: { ask: "What two numbers multiply to make $${n}$?", nudge: "Look at $${n}$." },
  pow_collect: { ask: "One prime appears more than once as a factor. How is a repeated factor written?", nudge: "The repeated factor." },
  lcm_powers: {
    ask: "A multiple of both numbers must contain everything each one contains. For each prime, how many times must it appear?",
    nudge: "Each prime, as often as the number that has the most of it.",
  },
  gcd_powers: {
    ask: "A divisor of both numbers can use only what both contain. Which primes do they share, and how many of each can both spare?",
    nudge: "Only the primes they share.",
  },
  euclid: {
    ask: "Whatever divides $${a}$ and $${b}$ also divides what is left when $${a}$ is divided by $${b}$. What is left?",
    nudge: "The remainder of $${a} \\div ${b}$.",
  },
  gcd_zero: { ask: "Every number divides $0$. What is the greatest number that divides both $${a}$ and $0$?", nudge: "$${a}$ and $0$." },
  mult_lit: { ask: "What is $${expr}$?", nudge: "$${expr}$." },
  pow_lit: { ask: "What is $${expr}$? Write it out as a product, then work it out.", nudge: "$${expr}$." },
  div_lit: { ask: "What is $${expr}$?", nudge: "$${expr}$." },
  lcm_by_gcd: {
    ask: "The greatest common divisor and the least common multiple of two numbers multiply to the two numbers' product. Which of them is easier to find here?",
    nudge: "$\\gcd \\cdot \\operatorname{lcm} = ab$.",
  },
  gcd_swap: { ask: "Does the order of the two numbers change their greatest common divisor?", nudge: "The order." },
  lcm_swap: { ask: "Does the order of the two numbers change their least common multiple?", nudge: "The order." },
};

export const RULES_SPOKEN = new Set(Object.keys(T));

function slots(node: MathNode): Record<string, string> {
  const kids = isFn(node) ? getChildren(node) : [];
  return { n: toLatex(node), expr: toLatex(node), a: kids[0] ? toLatex(kids[0]) : "", b: kids[1] ? toLatex(kids[1]) : "" };
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\$\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** The one question, pitched: a pointer if he owns the rule, the idea named if not. */
export function question(rule: string, node: MathNode, owned: boolean): string {
  const f = T[rule];
  if (!f) return "What is the next step?";
  return fill(owned ? f.nudge : f.ask, slots(node));
}

/** What the school says before the first line: the end, first. */
export function opening(kind: "lcm" | "gcd", a: number, b: number): string {
  return kind === "lcm"
    ? `You are looking for the smallest number that both $${a}$ and $${b}$ divide. Before the first line: what must such a number contain?`
    : `You are looking for the largest number that divides both $${a}$ and $${b}$. Before the first line: what can such a number contain?`;
}

/** The school's word on a line, and whether the line stands. */
export function verdict(v: Verdict, owned: (rule: string) => boolean): { stands: boolean; say: string } {
  switch (v.kind) {
    case "one":
      return { stands: true, say: owned(v.rule.id) ? "" : `${v.rule.name}.` };
    case "twice":
      return { stands: true, say: owned(v.rule.id) ? "" : `${v.rule.name}, in two places at once.` };
    case "two":
      return {
        stands: false,
        say: v.rules[0].id === v.rules[1].id
          ? `That is two steps in one line: ${lower(v.rules[0].name)}, and then the same again on what it gave. In this school a line holds one step. Write the first one.`
          : `That is two steps in one line: ${lower(v.rules[0].name)}, then ${lower(v.rules[1].name)}. In this school a line holds one step. Write the first one.`,
      };
    case "same":
      return { stands: false, say: "That is the line above, written again." };
    case "true":
      return { stands: false, say: "That is true, but no one rule takes the line above to it. What did you do between them? Write that step first." };
    case "false":
      return { stands: false, say: "That is not equal to the line above." };
    case "elsewhere":
      return { stands: false, say: "This line rewrites something that is not in the line above." };
  }
}

/** A rule's name in the middle of a sentence: a proper name (Euclid) or a capital abbreviation
 * (LCM, GCD) keeps its capitals. */
const lower = (s: string) => (/^(Euclid|[A-Z]{2})/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export const FOUND = "Q.E.I.";
export const FOUND_GLOSS = "Quod erat inveniendum: which was to be found.";
