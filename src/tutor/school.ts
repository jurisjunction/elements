import type { MathNode } from "mathjs";
import type { TacticPlugin } from "../types/tactic";
import { getAt, isFn, literalValue, structKey } from "../engine/ast";
import { legalMoves, solve, type Move } from "../engine/solver";

/**
 * Euler's school: among the legal moves, which one a master takes. Today it is a guess, and says
 * so: Euler factors what can be factored at sight and takes Euclid's way for numbers too large
 * for that. When his worked examples in the Elements of Algebra are read into lines of moves,
 * these weights are fitted on them, as Morphy's are on his games.
 */
export const STATUS = "Euler's school, stated: a guess, until his worked examples are read in";

const SIGHT = 100; // a number Euler's pupil factors at sight

export function prior(rule: string, node: MathNode | null): number {
  const v = node ? literalValue(node) : null;
  const args = node && isFn(node) ? node.args.map(literalValue) : [];
  const small = args.length ? args.every((a) => a !== null && a <= SIGHT) : true;
  switch (rule) {
    case "gcd_zero": return 95;
    case "prime_factor": return v !== null && v > SIGHT ? 40 : 90;
    case "euclid": return small ? 45 : 90;
    case "lcm_powers":
    case "gcd_powers": return 85;
    case "mult_lit":
    case "pow_lit":
    case "div_lit": return 70;
    case "pow_collect": return 60;
    case "lcm_by_gcd": return 50;
    case "gcd_swap":
    case "lcm_swap": return 30;
    default: return 20;
  }
}

export interface Choice {
  move: Move;
  rule: TacticPlugin;
  node: MathNode;
  /** Moves from here to the goal along this choice, the move itself included. */
  length: number;
}

/**
 * The master's next move from `line` toward `isGoal`: the move with the best weight among those
 * that still reach the goal, a longer way costing a little weight for each extra step.
 */
export function masterMove(line: MathNode, isGoal: (n: MathNode) => boolean, tactics: TacticPlugin[],
                           depth = 9): Choice | null {
  const byId = new Map(tactics.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let best: (Choice & { score: number }) | null = null;
  for (const { move, result } of legalMoves(line, tactics)) {
    const key = structKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    const rest = isGoal(result) ? [] : solve(result, isGoal, tactics, { maxDepth: depth - 1, maxStates: 20_000 });
    if (rest === null) continue;
    const node = getAt(line, move.path)!;
    const rule = byId.get(move.tacticId)!;
    const length = rest.length + 1;
    const score = prior(rule.id, node) - 12 * length;
    if (!best || score > best.score) best = { move, rule, node, length, score };
  }
  return best;
}
