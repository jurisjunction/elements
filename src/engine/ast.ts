import {
  ConstantNode as MConstantNode,
  FunctionNode as MFunctionNode,
  OperatorNode as MOperatorNode,
  SymbolNode as MSymbolNode,
  type MathNode,
} from "mathjs";
import type { NodePath } from "../types/tactic";

/**
 * Thin, loosely-typed views over mathjs nodes. The mathjs generics are very strict,
 * so the engine works with these shapes and builds nodes through the helpers below.
 */
export type OpFn = "add" | "subtract" | "multiply" | "divide" | "unaryMinus" | "pow" | "equal";

export interface OpNode extends MathNode {
  type: "OperatorNode";
  op: string;
  fn: OpFn;
  args: MathNode[];
  implicit: boolean;
}
export interface ConstNode extends MathNode {
  type: "ConstantNode";
  value: number;
}
export interface SymNode extends MathNode {
  type: "SymbolNode";
  name: string;
}
export interface FnNode extends MathNode {
  type: "FunctionNode";
  fn: SymNode;
  args: MathNode[];
}

export const RECIP = "recip";

const OP_SYMBOL: Record<OpFn, string> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  unaryMinus: "-",
  pow: "^",
  equal: "==",
};

// ---------- Predicates ----------

export const isOp = (n: MathNode, fn?: OpFn): n is OpNode =>
  n.type === "OperatorNode" && (fn === undefined || (n as OpNode).fn === fn);
export const isConst = (n: MathNode): n is ConstNode => n.type === "ConstantNode";
export const isSym = (n: MathNode): n is SymNode => n.type === "SymbolNode";
export const isFn = (n: MathNode, name?: string): n is FnNode =>
  n.type === "FunctionNode" && (name === undefined || (n as FnNode).fn.name === name);
export const isRecip = (n: MathNode): n is FnNode => isFn(n, RECIP);
export const isEquation = (n: MathNode): n is OpNode => isOp(n, "equal");

/** A literal number: a constant, or the negation of a constant (`-3`). */
export function literalValue(n: MathNode): number | null {
  if (isConst(n) && typeof n.value === "number") return n.value;
  if (isOp(n, "unaryMinus") && isConst(n.args[0]) && typeof n.args[0].value === "number") {
    return -n.args[0].value;
  }
  return null;
}

export const isIntLiteral = (n: MathNode): boolean => {
  const v = literalValue(n);
  return v !== null && Number.isInteger(v);
};

export const isZero = (n: MathNode): boolean => isConst(n) && n.value === 0;

// ---------- Builders ----------

export const num = (value: number): MathNode =>
  value < 0 ? neg(new MConstantNode(-value) as MathNode) : (new MConstantNode(value) as MathNode);
export const sym = (name: string): MathNode => new MSymbolNode(name) as MathNode;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Op = MOperatorNode as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Fn = MFunctionNode as any;

export const op = (fn: OpFn, args: MathNode[], implicit = false): MathNode =>
  new Op(OP_SYMBOL[fn], fn, args, implicit) as MathNode;
export const add = (a: MathNode, b: MathNode) => op("add", [a, b]);
export const sub = (a: MathNode, b: MathNode) => op("subtract", [a, b]);
export const mul = (a: MathNode, b: MathNode) => op("multiply", [a, b]);
export const div = (a: MathNode, b: MathNode) => op("divide", [a, b]);
export const neg = (a: MathNode) => op("unaryMinus", [a]);
export const eq = (a: MathNode, b: MathNode) => op("equal", [a, b]);
export const recip = (a: MathNode): MathNode => new Fn(new MSymbolNode(RECIP), [a]) as MathNode;

/** Rebuild a node of the same kind with new children. */
export function withArgs(n: MathNode, args: MathNode[]): MathNode {
  if (isOp(n)) return new Op(n.op, n.fn, args, n.implicit) as MathNode;
  if (isFn(n)) return new Fn(new MSymbolNode(n.fn.name), args) as MathNode;
  return n.cloneDeep();
}

// ---------- Paths ----------

export function getChildren(n: MathNode): MathNode[] {
  if (isOp(n) || isFn(n)) return n.args;
  return [];
}

export function getAt(root: MathNode, path: NodePath): MathNode | null {
  let cur: MathNode = root;
  for (const i of path) {
    const kids = getChildren(cur);
    if (i < 0 || i >= kids.length) return null;
    cur = kids[i];
  }
  return cur;
}

/** Returns a new tree with the node at `path` replaced. Does not mutate `root`. */
export function replaceAt(root: MathNode, path: NodePath, replacement: MathNode): MathNode {
  if (path.length === 0) return replacement;
  const [head, ...rest] = path;
  const kids = getChildren(root);
  if (head < 0 || head >= kids.length) throw new Error(`Invalid path segment ${head}`);
  const newKids = kids.map((k, i) => (i === head ? replaceAt(k, rest, replacement) : k.cloneDeep()));
  return withArgs(root, newKids);
}

export const pathEquals = (a: NodePath, b: NodePath) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// ---------- Structural equality ----------

/** Canonical string for structural comparison (ignores implicit vs explicit multiplication). */
export function structKey(n: MathNode): string {
  if (isConst(n)) return `#${n.value}`;
  if (isSym(n)) return `$${n.name}`;
  if (isOp(n)) return `${n.fn}(${n.args.map(structKey).join(",")})`;
  if (isFn(n)) return `@${n.fn.name}(${n.args.map(structKey).join(",")})`;
  return `?${n.type}:${n.toString()}`;
}

export const nodesEqual = (a: MathNode, b: MathNode) => structKey(a) === structKey(b);

/** Flatten a left-nested chain of one binary operator: `((a+b)+c)` → `[a, b, c]`. */
export function flattenLeft(n: MathNode, fn: OpFn): MathNode[] {
  if (isOp(n, fn) && n.args.length === 2) return [...flattenLeft(n.args[0], fn), n.args[1]];
  return [n];
}

/** Inverse of `flattenLeft`. */
export function buildLeft(fn: OpFn, terms: MathNode[]): MathNode {
  return terms.slice(1).reduce((acc, t) => op(fn, [acc, t]), terms[0]);
}
