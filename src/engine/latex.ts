import type { MathNode } from "mathjs";
import { isConst, isFn, isOp, isRecip, isSym, pathEquals, type OpNode } from "./ast";
import type { NodePath } from "../types/tactic";

export interface LatexOptions {
  /** Wrap every sub-expression in `\htmlData{path=…}` so it can be clicked. */
  interactive?: boolean;
  /** Highlight this sub-expression. */
  focus?: NodePath | null;
  /** Parenthesize left-nested chains too, e.g. `(a + b) + c`. Used for rule statements. */
  explicitGrouping?: boolean;
}

/** Encode a path for a `data-path` attribute: `[]` → `p`, `[0,1]` → `p0-1`. */
export const encodePath = (path: NodePath) => "p" + path.join("-");
export const decodePath = (s: string): NodePath =>
  s === "p" ? [] : s.slice(1).split("-").map(Number);

function prec(n: MathNode): number {
  if (!isOp(n)) return 9;
  switch (n.fn) {
    case "equal":
      return 0;
    case "add":
    case "subtract":
      return 1;
    case "multiply":
    case "divide":
      return 2;
    case "unaryMinus":
      return 3;
    case "pow":
      return 4;
  }
  return 9;
}

const isNeg = (n: MathNode) => isOp(n, "unaryMinus");
const isAtom = (n: MathNode) => isConst(n) || isSym(n);

/**
 * Render an AST to LaTeX. Parentheses always reflect the tree's actual grouping,
 * so `(ab)c` and `a(bc)` render differently.
 */
export function toLatex(root: MathNode, opts: LatexOptions = {}): string {
  const render = (n: MathNode, path: NodePath, parens: boolean): string => {
    let s = body(n, path);
    if (parens) s = `\\left(${s}\\right)`;
    if (opts.focus && pathEquals(opts.focus, path)) s = `\\htmlClass{am-focus}{${s}}`;
    if (opts.interactive) s = `\\htmlData{path=${encodePath(path)}}{${s}}`;
    return s;
  };

  const binary = (n: OpNode, path: NodePath, sym: string, lp: boolean, rp: boolean) =>
    `${render(n.args[0], [...path, 0], lp)}${sym ? ` ${sym} ` : " "}${render(n.args[1], [...path, 1], rp)}`;

  const body = (n: MathNode, path: NodePath): string => {
    if (isConst(n)) return String(n.value);
    if (isSym(n)) return n.name.length > 1 ? `\\mathrm{${n.name}}` : n.name;
    if (isRecip(n)) return `\\frac{1}{${render(n.args[0], [...path, 0], false)}}`;
    if (isFn(n)) {
      // \gcd is LaTeX's own operator; lcm has none, so it is set upright by \operatorname.
      const name = n.fn.name === "gcd" ? "\\gcd" : `\\operatorname{${n.fn.name}}`;
      return `${name}\\left(${n.args
        .map((a, i) => render(a, [...path, i], false))
        .join(", ")}\\right)`;
    }
    if (!isOp(n)) return n.toString();
    const [l, r] = n.args;
    switch (n.fn) {
      case "equal":
        return binary(n, path, "=", false, false);
      case "add":
      case "subtract":
        // Left-to-right chains need no parentheses (order of operations), so (a + b) + c shows
        // as a + b + c while a + (b + c) keeps its parentheses: the two stay distinguishable.
        return binary(n, path, n.fn === "add" ? "+" : "-", prec(l) < 1 || (!!opts.explicitGrouping && prec(l) === 1), prec(r) <= 1 || isNeg(r));
      case "multiply": {
        const lp = prec(l) < 2 || isNeg(l) || isOp(l, "divide") || (!!opts.explicitGrouping && isOp(l, "multiply"));
        const rp = prec(r) <= 2 || isNeg(r);
        // Juxtapose like the book (2x, xy, 51(9+31)); otherwise use a centered dot.
        const juxtapose = (lp || isAtom(l)) && (isSym(r) || rp || (isOp(r, "pow") && isSym(r.args[0])));
        return binary(n, path, juxtapose ? "" : "\\cdot", lp, rp);
      }
      case "divide":
        return binary(n, path, "\\div", prec(l) < 2 || isNeg(l) || isOp(l, "multiply"), prec(r) <= 2 || isNeg(r));
      case "unaryMinus":
        return `-${render(l, [...path, 0], isOp(l))}`;
      case "pow":
        return `{${render(l, [...path, 0], !isAtom(l))}}^{${render(r, [...path, 1], false)}}`;
    }
    return n.toString();
  };

  return render(root, [], false);
}
