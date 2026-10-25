import type { MathNode } from "mathjs";
import type { NodePath, TacticParams, TacticPlugin } from "../types/tactic";
import { getChildren, literalValue, replaceAt, structKey } from "./ast";
import { safeCanApply } from "./registry";

export interface Move {
  path: NodePath;
  tacticId: string;
  params?: TacticParams;
}

export interface SolveOptions {
  /** Maximum number of moves to search. */
  maxDepth: number;
  /** Give up after visiting this many distinct expressions. */
  maxStates?: number;
}

function allPaths(n: MathNode, prefix: NodePath = [], out: NodePath[] = []): NodePath[] {
  out.push(prefix);
  getChildren(n).forEach((c, i) => allPaths(c, [...prefix, i], out));
  return out;
}

/** Parameter choices the solver will try for a tactic (empty list = skip the tactic). */
function paramCandidates(t: TacticPlugin, node: MathNode): (TacticParams | undefined)[] {
  const schema = t.paramSchema;
  if (!schema) return [undefined];
  if (schema.type === "custom") return (schema.options ?? []).map((o) => ({ choice: o.value }));
  if (schema.type === "factors") {
    const n = literalValue(node);
    if (n === null || n < 4 || n > 10_000) return [];
    const out: TacticParams[] = [];
    for (let p = 2; p * p <= n; p++) {
      if (n % p === 0) {
        out.push({ p: String(p), q: String(n / p) });
        if (p !== n / p) out.push({ p: String(n / p), q: String(p) });
      }
    }
    return out;
  }
  return []; // free-form parameters (e.g. rearrangements) are not searched
}

/** Every legal single move from `root` using `tactics` (introducing moves are excluded). */
export function legalMoves(root: MathNode, tactics: TacticPlugin[]): { move: Move; result: MathNode }[] {
  const out: { move: Move; result: MathNode }[] = [];
  for (const path of allPaths(root)) {
    let node = root;
    for (const i of path) node = getChildren(node)[i];
    for (const t of tactics) {
      if (t.direction === "introduce" || !safeCanApply(t, node, { root, path })) continue;
      for (const params of paramCandidates(t, node)) {
        if (t.validateParams && params && t.validateParams(node, params)) continue;
        try {
          out.push({ move: { path, tacticId: t.id, params }, result: replaceAt(root, path, t.apply(node, params)) });
        } catch {
          // illegal with these params; skip
        }
      }
    }
  }
  return out;
}

/**
 * Breadth-first search for a shortest sequence of moves reaching `isGoal`.
 * Returns null if none is found within the limits.
 */
export function solve(
  start: MathNode,
  isGoal: (n: MathNode) => boolean,
  tactics: TacticPlugin[],
  { maxDepth, maxStates = 50_000 }: SolveOptions,
): Move[] | null {
  if (isGoal(start)) return [];
  const seen = new Set([structKey(start)]);
  let frontier: { node: MathNode; moves: Move[] }[] = [{ node: start, moves: [] }];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const { node, moves } of frontier) {
      for (const { move, result } of legalMoves(node, tactics)) {
        const key = structKey(result);
        if (seen.has(key)) continue;
        const path = [...moves, move];
        if (isGoal(result)) return path;
        seen.add(key);
        if (seen.size > maxStates) return null;
        next.push({ node: result, moves: path });
      }
    }
    frontier = next;
  }
  return null;
}
