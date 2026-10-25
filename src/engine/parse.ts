import { parse, type MathNode } from "mathjs";
import { eq, isConst, isFn, isOp, isSym, RECIP, withArgs, type OpFn } from "./ast";

export class ParseError extends Error {}

const ALLOWED_OPS: OpFn[] = ["add", "subtract", "multiply", "divide", "unaryMinus", "pow", "equal"];

/** Functions the engine knows, by arity: the greatest common divisor, the least common multiple,
 * and the reciprocal. */
const FUNCTIONS: Record<string, number> = { [RECIP]: 1, gcd: 2, lcm: 2 };

/**
 * Parse user input (or a rule pattern) into a normalized AST:
 * - ParenthesisNodes are removed (tree structure already encodes grouping),
 * - a single `=` becomes an equation node,
 * - only the node types the engine understands are allowed.
 * Order of operations is applied by the mathjs parser.
 */
export function parseProblem(input: string): MathNode {
  const text = input.trim();
  if (!text) throw new ParseError("Enter an expression.");

  const parts = text.split(/(?<![<>=!])=(?!=)/);
  if (parts.length > 2) throw new ParseError("An equation may contain only one “=”.");
  if (parts.length === 2) {
    if (!parts[0].trim() || !parts[1].trim()) throw new ParseError("Both sides of “=” need an expression.");
    return eq(parseExpr(parts[0]), parseExpr(parts[1]));
  }
  return parseExpr(text);
}

function parseExpr(text: string): MathNode {
  let node: MathNode;
  try {
    node = parse(text);
  } catch (e) {
    throw new ParseError(`Could not read “${text.trim()}”: ${(e as Error).message}`);
  }
  return normalize(node);
}

function normalize(n: MathNode): MathNode {
  if (n.type === "ParenthesisNode") return normalize((n as unknown as { content: MathNode }).content);
  if (isConst(n)) {
    if (typeof n.value !== "number" || !Number.isFinite(n.value)) {
      throw new ParseError(`Unsupported value “${n.toString()}”.`);
    }
    return n.cloneDeep();
  }
  if (isSym(n)) return n.cloneDeep();
  if (isOp(n)) {
    if (n.fn === ("unaryPlus" as OpFn)) return normalize(n.args[0]);
    if (!ALLOWED_OPS.includes(n.fn)) throw new ParseError(`The operator “${n.op}” is not supported yet.`);
    return withArgs(n, n.args.map(normalize));
  }
  if (isFn(n)) {
    const arity = FUNCTIONS[n.fn.name];
    if (arity === undefined || n.args.length !== arity) {
      throw new ParseError(`Unknown function “${n.fn.name}”. Known: gcd(a, b), lcm(a, b), recip(x).`);
    }
    return withArgs(n, n.args.map(normalize));
  }
  throw new ParseError(`Unsupported syntax: “${n.toString()}”.`);
}
