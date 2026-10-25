import type { MathNode } from "mathjs";

/** Path from the root to a node: a list of child indices (`args[i]`). `[]` is the root. */
export type NodePath = number[];

export type TacticCategory = "axiom" | "alu" | "macro";

/**
 * - `forward`: the rule as the book states it (lhs → rhs).
 * - `reverse`: the same identity read right-to-left (e.g. Factoring).
 * - `introduce`: a reverse move whose pattern matches any expression (e.g. `a → a + 0`).
 *   The drawer hides these by default because they are always applicable.
 */
export type TacticDirection = "forward" | "reverse" | "introduce";

export interface TacticContext {
  /** The full expression the target node lives in. */
  root: MathNode;
  /** Location of the target node inside `root`. */
  path: NodePath;
}

export interface ParamOption {
  value: string;
  label: string;
  /** Optional LaTeX preview shown next to the option. */
  latex?: string;
}

export interface TacticParamSchema {
  /** `expression`: free-text expression input, delivered as `params.expr`. */
  type: "factors" | "base10" | "custom" | "expression";
  /** `{n}` is replaced with the LaTeX of the selected node. */
  prompt: string;
  /** For `custom`: pick one of these; the chosen `value` arrives as `params.choice`. */
  options?: ParamOption[];
}

export type TacticParams = Record<string, string>;

export interface TacticPlugin {
  id: string;
  name: string;
  chapter: string;
  category: TacticCategory;
  description: string;
  /** Check if the selected AST node can undergo this transformation. */
  canApply: (node: MathNode, context?: TacticContext) => boolean;
  /** Prompts the user for extra input if needed. */
  paramSchema?: TacticParamSchema;
  /** Executes the exact single-step rewrite and returns the new node. May throw `TacticError`. */
  apply: (node: MathNode, params?: TacticParams) => MathNode;

  // ---- Optional extensions ----
  /** Topic within the chapter (e.g. "Negation"); used for drawer grouping. */
  section?: string;
  /** The rule itself in LaTeX, shown on the tactic card (e.g. `a(b+c) = ab + ac`). */
  ruleLatex?: string;
  direction?: TacticDirection;
  /** Educational explanation of why `canApply` is false for this node. */
  explainMismatch?: (node: MathNode, context?: TacticContext) => string;
  /** Return an error message if the params are invalid, otherwise `null`. */
  validateParams?: (node: MathNode, params: TacticParams) => string | null;
  /** Initial values for the parameter form (e.g. prefill an expression input). */
  paramDefaults?: (node: MathNode) => TacticParams;
  /** Assumptions the step relies on, as LaTeX (e.g. `x \neq 0`). */
  sideConditions?: (node: MathNode, params?: TacticParams) => string[];
}

/**
 * Declarative rewrite rule. Compiled into `TacticPlugin`s by `defineRules`.
 *
 * Patterns use the same syntax as problem input: single letters are pattern variables
 * that bind any sub-expression (repeated letters must match identical sub-expressions),
 * numbers are literals, `a / b` is division (÷), and `recip(x)` is the reciprocal 1/x.
 */
export interface RuleSpec {
  id: string;
  name: string;
  chapter: string;
  section?: string;
  category?: TacticCategory;
  description: string;
  lhs: string;
  /** Required unless `variants` is given. */
  rhs?: string;
  /** Several possible results; the user picks one. */
  variants?: { label: string; rhs: string }[];
  /** Also register the rhs → lhs direction. */
  bidirectional?: boolean;
  reverseName?: string;
  /** Pattern variables that must be nonzero (e.g. a divisor). */
  nonzero?: string[];
  /**
   * Also register an "(everywhere)" macro that applies the rule at every match inside the
   * selection in one step (for bidirectional rules, in both directions).
   */
  everywhere?: boolean;
  /** Specific explanations for near-misses: if the node matches `when`, show `message`. */
  pitfalls?: { when: string; message: string }[];
}

export interface State {
  exprNode: MathNode;
  latex: string;
  appliedTacticName: string | null;
  /** Where the tactic was applied (empty for the initial state). */
  targetPath: NodePath;
  sideConditions: string[];
}
