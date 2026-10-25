import { describe, expect, it } from "vitest";
import { readLine } from "../src/latex/reader";
import { structKey } from "../src/engine/ast";
import { parseProblem } from "../src/engine/parse";

const read = (s: string) => readLine(s);
const same = (s: string, plain: string) => {
  const r = read(s);
  expect(r.ok, JSON.stringify(r.notes)).toBe(true);
  if (r.ok) expect(structKey(r.node)).toBe(structKey(parseProblem(plain)));
  return r;
};
const refused = (s: string, says: string) => {
  const r = read(s);
  expect(r.ok).toBe(false);
  expect(r.notes.map((n) => n.text).join(" ")).toContain(says);
};

describe("the LaTeX reader reads as LaTeX sets", () => {
  it("reads the operators and functions of the lessons", () => {
    same("\\operatorname{lcm}(12, 18)", "lcm(12, 18)");
    same("\\gcd(84, 60)", "gcd(84, 60)");
    same("\\gcd\\left(84, 60\\right)", "gcd(84, 60)");
    same("2^{2} \\cdot 3^{2}", "2^2 * 3^2");
    same("2^2\\cdot3", "2^2 * 3");
    same("\\frac{18 \\cdot 24}{6}", "(18*24)/6");
    same("432 \\div 6", "432 / 6");
    same("\\operatorname{lcm}(2^{2} \\cdot 3,\\, 2 \\cdot 3^{2})", "lcm(2^2*3, 2*3^2)");
  });
  it("a leading = continues the line above; A = B names what it starts from", () => {
    const r = same("= 2^{2} \\cdot 3^{2}", "2^2*3^2");
    expect(r.ok && r.lhs).toBe(null);
    const s = same("12 = 2^{2} \\cdot 3", "2^2*3");
    expect(s.ok && s.lhs && structKey(s.lhs)).toBe(structKey(parseProblem("12")));
  });
  it("refuses what LaTeX would set wrongly, and says why", () => {
    refused("2^10", "the exponent is only the `1`");
    refused("lcm(12, 18)", "set as 3 letters in italics");
    refused("gcd(12, 18)", "`\\gcd`");
    refused("\\lcm(12, 18)", "no `\\lcm` command");
    refused("\\operatorname{lcm}(12, 18", "never closed");
    refused("2 x 3", "the letter x");
    refused("\\sqrt{4}", "not a command this page knows");
  });
  it("accepts what LaTeX sets rightly, with a compositor's note", () => {
    const star = same("4 * 9", "4*9");
    expect(star.notes.some((n) => n.text.includes("A star"))).toBe(true);
    const spaced = read("2 3");
    expect(spaced.ok && structKey(spaced.node)).toBe(structKey(parseProblem("23")));
    expect(spaced.notes.some((n) => n.text.includes("ignores spaces"))).toBe(true);
    const mathrm = same("\\mathrm{lcm}(4, 6)", "lcm(4, 6)");
    expect(mathrm.notes.some((n) => n.text.includes("\\operatorname{lcm}"))).toBe(true);
  });
});
