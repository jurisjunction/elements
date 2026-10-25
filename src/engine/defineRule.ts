import type { MathNode } from "mathjs";
import type { RuleSpec, TacticParams, TacticPlugin } from "../types/tactic";
import { getChildren, isEquation, isOp, isSym, isZero, literalValue, withArgs } from "./ast";
import { TacticError } from "./errors";
import { toLatex } from "./latex";
import { compilePattern, instantiate, match, patternVars, type Bindings } from "./pattern";

const tex = (n: MathNode) => toLatex(n);

interface Direction {
  id: string;
  name: string;
  lhs: MathNode;
  results: { label: string; rhs: MathNode }[];
  direction: TacticPlugin["direction"];
  pitfalls: { when: MathNode; message: string }[];
}

/** Compile declarative rewrite rules into tactic plugins (forward, plus reverse if requested). */
export function defineRules(specs: RuleSpec[]): TacticPlugin[] {
  return specs.flatMap(defineRule);
}

export function defineRule(spec: RuleSpec): TacticPlugin[] {
  const lhs = compilePattern(spec.lhs);
  const results = spec.variants
    ? spec.variants.map((v) => ({ label: v.label, rhs: compilePattern(v.rhs) }))
    : spec.rhs
      ? [{ label: spec.name, rhs: compilePattern(spec.rhs) }]
      : [];
  if (results.length === 0) throw new Error(`Rule ${spec.id} needs rhs or variants`);

  const lhsVars = patternVars(lhs);
  for (const r of results) {
    for (const v of patternVars(r.rhs)) {
      if (!lhsVars.has(v)) throw new Error(`Rule ${spec.id}: rhs variable “${v}” does not appear in lhs`);
    }
  }

  const dirs: Direction[] = [
    {
      id: spec.id,
      name: spec.name,
      lhs,
      results,
      direction: "forward",
      pitfalls: (spec.pitfalls ?? []).map((p) => ({ when: compilePattern(p.when), message: p.message })),
    },
  ];

  if (spec.bidirectional) {
    if (results.length !== 1) throw new Error(`Rule ${spec.id}: bidirectional rules cannot have variants`);
    const rhs = results[0].rhs;
    const rhsVars = patternVars(rhs);
    if ([...lhsVars].some((v) => !rhsVars.has(v))) {
      throw new Error(`Rule ${spec.id}: cannot reverse, lhs has variables the rhs does not`);
    }
    const name = spec.reverseName ?? `${spec.name} (reverse)`;
    dirs.push({
      id: `${spec.id}_rev`,
      name,
      lhs: rhs,
      results: [{ label: name, rhs: lhs }],
      direction: isSym(rhs) ? "introduce" : "reverse",
      pitfalls: [],
    });
  }

  const plugins = dirs.map((d) => compileDirection(spec, d));
  if (spec.everywhere) {
    for (const d of dirs) {
      if (d.results.length === 1 && d.direction !== "introduce") plugins.push(compileEverywhere(spec, d));
    }
  }
  return plugins;
}

/**
 * Macro: rewrite every match of the rule inside the selected sub-expression, bottom-up.
 * Each node is rewritten at most once (results are not re-scanned), and since the tree
 * already encodes order of operations, e.g. `a - b - c` becomes `a + (-b) + (-c)`.
 */
function compileEverywhere(spec: RuleSpec, d: Direction): TacticPlugin {
  const nonzero = spec.nonzero ?? [];
  const rhs = d.results[0].rhs;
  const bindAt = (n: MathNode): Bindings | null => {
    const b = match(d.lhs, n);
    return b && !nonzero.some((v) => b[v] && isZero(b[v])) ? b : null;
  };
  const walk = (n: MathNode, onMatch?: (b: Bindings) => void): { node: MathNode; count: number } => {
    let count = 0;
    const kids = getChildren(n).map((c) => {
      const r = walk(c, onMatch);
      count += r.count;
      return r.node;
    });
    const rebuilt = kids.length ? withArgs(n, kids) : n.cloneDeep();
    const b = bindAt(rebuilt);
    if (!b) return { node: rebuilt, count };
    onMatch?.(b);
    return { node: instantiate(rhs, b), count: count + 1 };
  };
  const name = d.name.endsWith(")") ? `${d.name.slice(0, -1)}, everywhere)` : `${d.name} (everywhere)`;

  return {
    id: `${d.id}_all`,
    name,
    chapter: spec.chapter,
    section: spec.section,
    category: "macro",
    direction: d.direction,
    description: `Apply ${d.name} to every matching part of the selection at once.`,
    ruleLatex: `${toLatex(d.lhs, { explicitGrouping: true })} \\to ${toLatex(rhs, { explicitGrouping: true })}\\quad\\text{(everywhere)}`,
    canApply: (node) => walk(node).count > 0,
    explainMismatch: (node) =>
      `Nothing inside $${tex(node)}$ has the form $${toLatex(d.lhs, { explicitGrouping: true })}$, so there is nothing to rewrite.`,
    apply: (node) => {
      const r = walk(node);
      if (r.count === 0) throw new TacticError("Nothing to rewrite.");
      return r.node;
    },
    sideConditions: (node) => {
      const out = new Set<string>();
      walk(node, (b) =>
        nonzero.filter((v) => b[v] && literalValue(b[v]) === null).forEach((v) => out.add(`${tex(b[v])} \\neq 0`)),
      );
      return [...out];
    },
  };
}

function compileDirection(spec: RuleSpec, d: Direction): TacticPlugin {
  const nonzero = spec.nonzero ?? [];
  const arrow = isEquation(d.lhs) ? "\\;\\Rightarrow\\;" : " = ";
  const rule = (n: MathNode) => toLatex(n, { explicitGrouping: true });
  const ruleLatex =
    rule(d.lhs) + arrow + d.results.map((r) => rule(r.rhs)).join("\\quad\\text{or}\\quad ");

  const zeroVar = (b: Bindings) => nonzero.find((v) => b[v] && isZero(b[v]));

  const bind = (node: MathNode): Bindings | null => match(d.lhs, node);

  const explainMismatch = (node: MathNode): string => {
    for (const p of d.pitfalls) if (match(p.when, node)) return p.message;
    const b = bind(node);
    if (b) {
      const v = zeroVar(b);
      if (v) {
        return `This rule needs $${v} \\neq 0$, but here $${v} = 0$. The reciprocal of 0 is undefined, so we can never divide by 0.`;
      }
    }
    let msg = `**${d.name}** applies to expressions of the form $${rule(d.lhs)}$. The selected expression $${tex(node)}$ does not have that shape.`;
    if (isOp(node, "add") || isOp(node, "multiply")) {
      const swapped = withArgs(node, [...node.args].reverse());
      if (bind(swapped)) {
        msg += ` It would match with the two sides swapped. Try the Commutative Property first.`;
      }
    }
    return msg;
  };

  const plugin: TacticPlugin = {
    id: d.id,
    name: d.name,
    chapter: spec.chapter,
    section: spec.section,
    category: spec.category ?? "axiom",
    description: spec.description,
    direction: d.direction,
    ruleLatex,
    canApply: (node) => {
      const b = bind(node);
      return b !== null && zeroVar(b) === undefined;
    },
    explainMismatch,
    apply: (node: MathNode, params?: TacticParams) => {
      const b = bind(node);
      if (!b || zeroVar(b)) throw new TacticError(explainMismatch(node));
      const idx = d.results.length > 1 ? Number(params?.choice) : 0;
      const result = d.results[idx];
      if (!result) throw new TacticError("Choose which form of the result you want.");
      return instantiate(result.rhs, b);
    },
    sideConditions: (node) => {
      const b = bind(node);
      if (!b) return [];
      return nonzero
        .filter((v) => b[v] && literalValue(b[v]) === null)
        .map((v) => `${tex(b[v])} \\neq 0`);
    },
  };

  if (d.results.length > 1) {
    plugin.paramSchema = {
      type: "custom",
      prompt: "Which result do you want?",
      options: d.results.map((r, i) => ({ value: String(i), label: r.label, latex: tex(r.rhs) })),
    };
  }
  return plugin;
}
