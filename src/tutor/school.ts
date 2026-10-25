import type { MathNode } from "mathjs";
import type { TacticPlugin } from "../types/tactic";
import { getAt, structKey } from "../engine/ast";
import { parseProblem } from "../engine/parse";
import { legalMoves, type Move } from "../engine/solver";
import { SOURCE, WORKED } from "../euler/gcd";

/**
 * Euler's school: among the legal moves, which one a master takes. Read off his worked examples:
 * at every line of every example, which rules were open and which one he took. A rule's weight
 * is how often he took it when it was open (with one taken and one passed over added, so that a
 * handful of examples does not make a certainty). A rule his examples never offer keeps a stated
 * guess, and says so.
 */

export interface Evidence {
  open: number;
  taken: number;
}

/** Count, over Euler's lines, how often each rule was open and how often he took it. */
export function evidenceFrom(tactics: TacticPlugin[]): Map<string, Evidence> {
  const out = new Map<string, Evidence>();
  for (const w of WORKED) {
    for (let i = 0; i + 1 < w.lines.length; i++) {
      const here = parseProblem(w.lines[i]);
      const next = structKey(parseProblem(w.lines[i + 1]));
      const moves = legalMoves(here, tactics);
      const open = new Set(moves.map((m) => m.move.tacticId));
      const took = moves.find((m) => structKey(m.result) === next)?.move.tacticId;
      for (const id of open) {
        const e = out.get(id) ?? { open: 0, taken: 0 };
        e.open++;
        if (id === took) e.taken++;
        out.set(id, e);
      }
    }
  }
  return out;
}

const GUESS: Record<string, number> = {
  prime_factor: 85, lcm_powers: 85, gcd_powers: 85, mult_lit: 70, pow_lit: 70, div_lit: 70,
  pow_collect: 60, lcm_by_gcd: 50, lcm_swap: 30,
};

let read: Map<string, Evidence> | null = null;
let readFrom: TacticPlugin[] | null = null;

export function evidence(tactics: TacticPlugin[]): Map<string, Evidence> {
  if (!read || readFrom !== tactics) {
    read = evidenceFrom(tactics);
    readFrom = tactics;
  }
  return read;
}

/** The weight of a rule, 0 to 100, and where it comes from. */
export function weight(rule: string, tactics: TacticPlugin[]): { w: number; from: string } {
  const e = evidence(tactics).get(rule);
  if (e) {
    return { w: Math.round((100 * (e.taken + 1)) / (e.open + 2)), from: `taken ${e.taken} of the ${e.open} times it was open` };
  }
  return { w: GUESS[rule] ?? 20, from: "a stated guess: his examples here never offer it" };
}

export function status(tactics: TacticPlugin[]): string {
  const lines = WORKED.reduce((n, w) => n + w.lines.length - 1, 0);
  const fitted = [...evidence(tactics).keys()].length;
  return `Euler's school, read from his own worked examples (${SOURCE}: ${WORKED.length} examples, ${lines} lines); ` +
    `${fitted} rules weighed from them, the rest a stated guess`;
}

export interface Choice {
  move: Move;
  rule: TacticPlugin;
  node: MathNode;
  /** Moves from here to the goal along this choice, the move itself included. */
  length: number;
}

/**
 * The master's next move from `line` toward `isGoal`: the first move of the way he would most
 * likely go. A rule's weight is read as how likely he is to take it, so a way costs the sum of
 * −ln(weight) over its moves, and the cheapest way is the most likely one. Every move costs
 * something, so going round in a circle never pays. `weigh` is the rule set the weights are
 * read with (the whole school's); `tactics` is what this lesson allows. Capped by states, not
 * time; ties go to the first move found.
 */
export function masterMove(line: MathNode, isGoal: (n: MathNode) => boolean, tactics: TacticPlugin[],
                           weigh: TacticPlugin[] = tactics, depth = 12, maxStates = 20_000): Choice | null {
  if (isGoal(line)) return null;
  const cost = new Map<string, number>();
  for (const t of tactics) cost.set(t.id, -Math.log(weight(t.id, weigh).w / 100));
  type Way = { node: MathNode; c: number; n: number; first: { move: Move } | null; order: number };
  const heap: Way[] = [];
  const less = (a: Way, b: Way) => a.c < b.c - 1e-12 || (Math.abs(a.c - b.c) <= 1e-12 && a.order < b.order);
  const push = (w: Way) => {
    heap.push(w);
    for (let i = heap.length - 1; i > 0;) {
      const j = (i - 1) >> 1;
      if (!less(heap[i], heap[j])) break;
      [heap[i], heap[j]] = [heap[j], heap[i]];
      i = j;
    }
  };
  const pop = (): Way => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };
  let order = 0;
  const done = new Set<string>();
  push({ node: line, c: 0, n: 0, first: null, order: order++ });
  while (heap.length && done.size < maxStates) {
    const w = pop();
    const key = structKey(w.node);
    if (done.has(key)) continue;
    done.add(key);
    if (isGoal(w.node) && w.first) {
      const move = w.first.move;
      return { move, rule: tactics.find((t) => t.id === move.tacticId)!, node: getAt(line, move.path)!, length: w.n };
    }
    if (w.n >= depth) continue;
    for (const { move, result } of legalMoves(w.node, tactics)) {
      if (done.has(structKey(result))) continue;
      push({ node: result, c: w.c + cost.get(move.tacticId)!, n: w.n + 1, first: w.first ?? { move }, order: order++ });
    }
  }
  return null;
}
