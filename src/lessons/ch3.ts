import { PURPOSE, RULE, WORKED, type Quote } from "../euler/gcd";

/**
 * The lessons, in the order of the AoPS Pre-Algebra course his class follows (Chapter 3, Number
 * Theory). Only the order of topics is the course's. The problems are this copybook's own, or
 * Euler's: his worked examples are public domain, and each carries its section.
 */

export interface Problem {
  id: string;
  kind: "lcm" | "gcd";
  a: number;
  b: number;
  /** The first line, in the engine's syntax. */
  start: string;
  goal: number;
  /** Euler's own example: where it is, and what he said it came to. */
  euler?: { cite: string; said: Quote };
}

export interface Lesson {
  id: string;
  numeral: string;
  title: string;
  aops: string;
  /** The rules this lesson's lines may use. */
  rules: string[];
  problems: Problem[];
  /** What the lesson is for, and its rule, in Euler's words. */
  purpose?: Quote;
  rule?: Quote;
}

const ARITH = ["mult_lit", "pow_lit", "div_lit"];
const PRIMES = ["prime_factor", "int_factor", "pow_collect"];

const p = (kind: "lcm" | "gcd", a: number, b: number, goal: number): Problem => ({
  id: `${kind}-${a}-${b}`, kind, a, b, start: `${kind}(${a}, ${b})`, goal,
});

export const LESSONS: Lesson[] = [
  {
    id: "lcm",
    numeral: "I",
    title: "Of the least common multiple",
    aops: "AoPS Pre-Algebra, Ch. 3 Number Theory: least common multiples",
    rules: [...PRIMES, "lcm_powers", "lcm_swap", ...ARITH],
    problems: [p("lcm", 4, 6, 12), p("lcm", 12, 18, 36), p("lcm", 8, 12, 24), p("lcm", 9, 15, 45),
               p("lcm", 14, 21, 42), p("lcm", 16, 40, 80)],
  },
  {
    id: "gcd",
    numeral: "II",
    title: "Of the greatest common divisor",
    aops: "AoPS Pre-Algebra, Ch. 3 Number Theory: greatest common divisors",
    rules: [...PRIMES, "gcd_powers", "gcd_swap", ...ARITH],
    problems: [p("gcd", 12, 18, 6), p("gcd", 24, 36, 12), p("gcd", 35, 49, 7), p("gcd", 17, 30, 1),
               p("gcd", 60, 84, 12)],
  },
  {
    id: "euclid",
    numeral: "III",
    title: "Of the greatest common divisor of two given numbers, after Euler",
    aops: "AoPS Pre-Algebra, Ch. 3 Number Theory: greatest common divisors · Euler, Elements, Part I, Sect. III, Ch. VII",
    rules: [...PRIMES, "gcd_powers", "euclid", "gcd_zero", "gcd_swap", ...ARITH],
    purpose: PURPOSE,
    rule: RULE,
    // His four worked examples first (ids are new; the older problems keep theirs).
    problems: [...WORKED.map((w) => ({ ...p("gcd", w.a, w.b, w.answer), euler: { cite: w.cite, said: w.said } })),
               p("gcd", 84, 60, 12), p("gcd", 91, 65, 13), p("gcd", 252, 198, 18), p("gcd", 1071, 462, 21)],
  },
  {
    id: "both",
    numeral: "IV",
    title: "Of the two together",
    aops: "AoPS Pre-Algebra, Ch. 3 Number Theory: least common multiples and greatest common divisors",
    rules: [...PRIMES, "lcm_powers", "gcd_powers", "euclid", "gcd_zero", "gcd_swap", "lcm_swap", "lcm_by_gcd", ...ARITH],
    problems: [p("lcm", 18, 24, 72), p("lcm", 84, 60, 420), p("lcm", 91, 65, 455)],
  },
];
