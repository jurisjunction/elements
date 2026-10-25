import type { MathNode } from "mathjs";
import type { TacticPlugin } from "../types/tactic";
import { getChildren, isConst, isFn, isOp, nodesEqual, replaceAt, structKey } from "../engine/ast";
import { legalMoves, type Move } from "../engine/solver";
import type { NodePath } from "../types/tactic";

/**
 * Is the pupil's new line one step from the line above? The judge is the engine: the line is
 * accepted when one legal move (or two, said so) takes the line above to it. A true line no rule
 * reaches is not refused as false; it is asked about.
 */

export type Verdict =
  | { kind: "one"; move: Move; rule: TacticPlugin }
  | { kind: "two"; moves: [Move, Move]; rules: [TacticPlugin, TacticPlugin] }
  /** One rule used in two places, as a pupil factors both numbers on one line. */
  | { kind: "twice"; moves: [Move, Move]; rule: TacticPlugin }
  | { kind: "same" }
  | { kind: "true" }
  | { kind: "false" }
  | { kind: "elsewhere" };

/** The value of a tree of whole numbers, or null. For judging only: no move ever evaluates. */
export function valueOf(n: MathNode): number | null {
  if (isConst(n)) return typeof n.value === "number" ? n.value : null;
  const kids = getChildren(n).map(valueOf);
  if (kids.some((k) => k === null)) return null;
  const [a, b] = kids as number[];
  if (isFn(n, "gcd")) return gcd(a, b);
  if (isFn(n, "lcm")) return a === 0 || b === 0 ? 0 : (a / gcd(a, b)) * b;
  if (isFn(n, "recip")) return a === 0 ? null : 1 / a;
  if (!isOp(n)) return null;
  switch (n.fn) {
    case "add": return a + b;
    case "subtract": return a - b;
    case "multiply": return a * b;
    case "divide": return b === 0 ? null : a / b;
    case "unaryMinus": return -a;
    case "pow": return a ** b;
  }
  return null;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function find(root: MathNode, target: MathNode, path: NodePath = []): NodePath | null {
  if (nodesEqual(root, target)) return path;
  const kids = getChildren(root);
  for (let i = 0; i < kids.length; i++) {
    const p = find(kids[i], target, [...path, i]);
    if (p) return p;
  }
  return null;
}

/**
 * The line the pupil means. `lhs = rhs` where lhs is part of the line above rewrites that part,
 * as a side working written on paper ("12 = 2² · 3" while finding lcm(12, 18)).
 */
export function intended(prev: MathNode, node: MathNode, lhs: MathNode | null): MathNode | "elsewhere" {
  if (!lhs || nodesEqual(lhs, prev)) return node;
  const at = find(prev, lhs);
  return at ? replaceAt(prev, at, node) : "elsewhere";
}

export function judge(prev: MathNode, next: MathNode, tactics: TacticPlugin[]): Verdict {
  const key = structKey(next);
  if (key === structKey(prev)) return { kind: "same" };
  const byId = new Map(tactics.map((t) => [t.id, t]));
  const first = legalMoves(prev, tactics);
  const one = first.find((m) => structKey(m.result) === key);
  if (one) return { kind: "one", move: one.move, rule: byId.get(one.move.tacticId)! };
  for (const m of first) {
    const two = legalMoves(m.result, tactics).find((x) => structKey(x.result) === key);
    if (two) {
      const [r1, r2] = [byId.get(m.move.tacticId)!, byId.get(two.move.tacticId)!];
      if (r1.id === r2.id) return { kind: "twice", moves: [m.move, two.move], rule: r1 };
      return { kind: "two", moves: [m.move, two.move], rules: [r1, r2] };
    }
  }
  const a = valueOf(prev);
  const b = valueOf(next);
  return a !== null && b !== null && Math.abs(a - b) < 1e-9 ? { kind: "true" } : { kind: "false" };
}
