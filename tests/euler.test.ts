import { describe, expect, it } from "vitest";
import { parseProblem } from "../src/engine/parse";
import { isConst, replaceAt, structKey } from "../src/engine/ast";
import { rules, searchable } from "../src/rules/numbertheory";
import { judge } from "../src/tutor/check";
import { evidence, masterMove, status, weight } from "../src/tutor/school";
import { LESSONS } from "../src/lessons/ch3";
import { longDivision, PURPOSE, RULE, WORKED } from "../src/euler/gcd";

const P = (s: string) => parseProblem(s);
const III = LESSONS.find((l) => l.id === "euclid")!;
const allowed = rules.filter((r) => III.rules.includes(r.id));
const search = searchable.filter((r) => III.rules.includes(r.id));
const FS = " ";

describe("Euler's own examples (Elements, Part I, Sect. III, Ch. VII)", () => {
  it("every line he wrote is one legal step by Lesson III's rules, and ends at his answer", () => {
    for (const w of WORKED) {
      expect(w.lines[0]).toBe(`gcd(${w.a}, ${w.b})`);
      expect(w.lines[w.lines.length - 1]).toBe(String(w.answer));
      for (let i = 0; i + 1 < w.lines.length; i++) {
        const v = judge(P(w.lines[i]), P(w.lines[i + 1]), allowed);
        expect(v.kind, `${w.cite}: ${w.lines[i]} → ${w.lines[i + 1]}`).toBe("one");
      }
    }
  });

  it("the school, weighed from his lines, goes his way on each of them", () => {
    for (const w of WORKED) {
      const goal = (n: ReturnType<typeof P>) => isConst(n) && n.value === w.answer;
      let node = P(w.lines[0]);
      const went = [w.lines[0]];
      for (let i = 0; i < 12 && !goal(node); i++) {
        const c = masterMove(node, goal, search, searchable)!;
        node = replaceAt(node, c.move.path, c.rule.apply(c.node, c.move.params));
        went.push(structKey(node));
      }
      expect(went.slice(1), w.cite).toEqual(w.lines.slice(1).map((l) => structKey(P(l))));
    }
  });

  it("weighs Euclid's way from what he took, and says which weights are guesses", () => {
    const e = evidence(searchable);
    expect(e.get("euclid")).toEqual({ open: 17, taken: 17 });
    expect(e.get("prime_factor")!.taken).toBe(0);
    expect(weight("euclid", searchable).w).toBeGreaterThan(weight("prime_factor", searchable).w);
    expect(weight("lcm_powers", searchable).from).toContain("stated guess");
    expect(status(searchable)).toContain("4 examples, 21 lines");
  });

  it("his examples come first in Lesson III, and the older problems keep their ids", () => {
    expect(III.problems.slice(0, 4).map((p) => p.id)).toEqual(["gcd-576-252", "gcd-504-312", "gcd-625-529", "gcd-1728-2304"]);
    expect(III.problems.slice(4).map((p) => p.id)).toEqual(["gcd-84-60", "gcd-91-65", "gcd-252-198", "gcd-1071-462"]);
    expect(III.problems.slice(0, 4).every((p) => p.euler?.said.text && /^§\d+$/.test(p.euler.cite))).toBe(true);
  });

  it("quotes him with his sections", () => {
    expect(PURPOSE.cite).toBe("§449");
    expect(RULE.cite).toBe("§452");
    expect(RULE.text).toMatch(/^Divide the greater of the two numbers by the less/);
  });

  it("lays out his long division as he printed it (§452)", () => {
    const t = longDivision(576, 252).map((l) => (l.ruled ? "_" : " ") + l.text.replaceAll(FS, " "));
    expect(t).toEqual([
      " 252) 576 (2",
      "_     504",
      "       72) 252 (3",
      "_          216",
      "            36) 72 (2",
      "_               72",
      "                 0.",
    ]);
    // The greater is divided by the less, whichever is written first (§460).
    expect(longDivision(1728, 2304)[0].text).toBe("1728) 2304 (1");
  });
});
