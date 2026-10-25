import type { MathNode } from "mathjs";
import { getChildren, isConst, isFn, isOp, isSym, nodesEqual, withArgs } from "./ast";
import { parseProblem } from "./parse";

export type Bindings = Record<string, MathNode>;

const cache = new Map<string, MathNode>();

/** Parse (and cache) a pattern string such as `a*(b+c)`. */
export function compilePattern(src: string): MathNode {
  let p = cache.get(src);
  if (!p) {
    p = parseProblem(src);
    cache.set(src, p);
  }
  return p;
}

/**
 * Match `node` against `pattern`. Symbols in the pattern are variables that bind any
 * sub-expression; a variable used twice must bind structurally identical sub-expressions.
 */
export function match(pattern: MathNode, node: MathNode, bindings: Bindings = {}): Bindings | null {
  if (isSym(pattern)) {
    const bound = bindings[pattern.name];
    if (bound) return nodesEqual(bound, node) ? bindings : null;
    return { ...bindings, [pattern.name]: node };
  }
  if (isConst(pattern)) return isConst(node) && node.value === pattern.value ? bindings : null;
  if (isOp(pattern)) {
    if (!isOp(node, pattern.fn) || node.args.length !== pattern.args.length) return null;
  } else if (isFn(pattern)) {
    if (!isFn(node, pattern.fn.name) || node.args.length !== pattern.args.length) return null;
  } else {
    return null;
  }
  const pk = getChildren(pattern);
  const nk = getChildren(node);
  let b: Bindings | null = bindings;
  for (let i = 0; i < pk.length && b; i++) b = match(pk[i], nk[i], b);
  return b;
}

/** Build a node from a template, substituting bound variables. */
export function instantiate(template: MathNode, bindings: Bindings): MathNode {
  if (isSym(template)) {
    const b = bindings[template.name];
    if (!b) throw new Error(`Pattern variable “${template.name}” is not bound`);
    return b.cloneDeep();
  }
  if (isOp(template) || isFn(template)) {
    return withArgs(template, getChildren(template).map((c) => instantiate(c, bindings)));
  }
  return template.cloneDeep();
}

export function patternVars(p: MathNode, out = new Set<string>()): Set<string> {
  if (isSym(p)) out.add(p.name);
  getChildren(p).forEach((c) => patternVars(c, out));
  return out;
}
