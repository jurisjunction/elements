/**
 * Euler's chapter on the greatest common divisor: Elements of Algebra, Part I, Section III,
 * Chapter VII (§451–460), in Hewlett's English translation (1822; public domain). Each worked
 * example is read here into lines of moves, one division to a line, as he set them out. The
 * engine checks every line is one legal step (tests/euler.test.ts). The words quoted are his, as
 * printed; every quotation carries its section.
 */

export interface Quote {
  text: string;
  cite: string;
}

export interface Worked {
  /** As Euler wrote them, in his order. */
  a: number;
  b: number;
  cite: string;
  /** His lines, in the engine's syntax: from gcd(a, b) to the divisor he finds. */
  lines: string[];
  answer: number;
  /** What he said it came to, in his words. */
  said: Quote;
}

export const SOURCE = "Euler, Elements of Algebra, Part I, Sect. III, Ch. VII";

export const PURPOSE: Quote = {
  text: "In order, therefore, to express any relation in the clearest manner, it is necessary to reduce it to the smallest possible numbers; which is easily done, by dividing the two terms of it by their greatest common divisor.",
  cite: "§449",
};

export const RULE: Quote = {
  text: "Divide the greater of the two numbers by the less; next, divide the preceding divisor by the remainder; what remains in this second division will afterwards become a divisor for a third division, in which the remainder of the preceding divisor will be the dividend. We must continue this operation till we arrive at a division that leaves no remainder; and this last divisor will be the greatest common divisor of the two given numbers.",
  cite: "§452",
};

export const WORKED: Worked[] = [
  {
    a: 576, b: 252, cite: "§452", answer: 36,
    lines: ["gcd(576, 252)", "gcd(252, 72)", "gcd(72, 36)", "gcd(36, 0)", "36"],
    said: { text: "So that, in this instance, the greatest common divisor is 36.", cite: "§452" },
  },
  {
    a: 504, b: 312, cite: "§453", answer: 24,
    lines: ["gcd(504, 312)", "gcd(312, 192)", "gcd(192, 120)", "gcd(120, 72)", "gcd(72, 48)", "gcd(48, 24)",
            "gcd(24, 0)", "24"],
    said: {
      text: "So that 24 is the greatest common divisor; and consequently the relation 504 : 312 is reduced to the form 21 : 13.",
      cite: "§453",
    },
  },
  {
    a: 625, b: 529, cite: "§454", answer: 1,
    lines: ["gcd(625, 529)", "gcd(529, 96)", "gcd(96, 49)", "gcd(49, 47)", "gcd(47, 2)", "gcd(2, 1)", "gcd(1, 0)", "1"],
    said: {
      text: "Wherefore 1 is, in this case, the greatest common divisor, and consequently we cannot express the relation 625 : 529 by less numbers, nor reduce it to simpler terms.",
      cite: "§454",
    },
  },
  {
    a: 1728, b: 2304, cite: "§460", answer: 576,
    lines: ["gcd(1728, 2304)", "gcd(1728, 576)", "gcd(576, 0)", "576"],
    said: {
      text: "Hence it follows that 576 is the greatest common divisor, and that the relation 1728 : 2304 is reduced to 3 : 4; that is to say, 1728 is to 2304 in the same relation as 3 is to 4.",
      cite: "§460",
    },
  },
];

/**
 * His working as he printed it: each division `divisor) dividend (quotient`, the product under the
 * dividend, the remainder under that becoming the next divisor, until a division leaves nothing.
 * Computed from the two numbers, laid out as on his page. Figure spaces keep the columns when the
 * digits are tabular.
 */
export function longDivision(a: number, b: number): { text: string; ruled: boolean }[] {
  const FS = " ";
  const pad = (n: number) => FS.repeat(Math.max(0, n));
  let [n, d] = a >= b ? [a, b] : [b, a];
  const out: { text: string; ruled: boolean }[] = [];
  let indent = 0;
  while (d > 0) {
    const q = Math.floor(n / d);
    const r = n % d;
    const head = `${d}) ${n} (${q}`;
    out.push({ text: pad(indent) + head, ruled: false });
    const right = indent + `${d}) `.length + `${n}`.length;
    out.push({ text: pad(right - `${q * d}`.length) + `${q * d}`, ruled: true });
    if (r === 0) {
      out.push({ text: pad(right - 1) + "0.", ruled: false });
      break;
    }
    indent = right - `${r}`.length;
    [n, d] = [d, r];
  }
  return out;
}
