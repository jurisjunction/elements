import type { MathNode } from "mathjs";
import type { TacticContext, TacticPlugin } from "../types/tactic";

export class TacticRegistry {
  private tactics = new Map<string, TacticPlugin>();

  registerTactic(tactic: TacticPlugin): void {
    if (this.tactics.has(tactic.id)) throw new Error(`Duplicate tactic id “${tactic.id}”`);
    this.tactics.set(tactic.id, tactic);
  }

  registerAll(tactics: TacticPlugin[]): void {
    tactics.forEach((t) => this.registerTactic(t));
  }

  unregister(id: string): void {
    this.tactics.delete(id);
  }

  clear(): void {
    this.tactics.clear();
  }

  getAll(): TacticPlugin[] {
    return [...this.tactics.values()];
  }

  getById(id: string): TacticPlugin | undefined {
    return this.tactics.get(id);
  }

  /** Chapters in registration order. */
  getChapters(): string[] {
    return [...new Set(this.getAll().map((t) => t.chapter))];
  }

  getTacticsByChapter(chapterId: string): TacticPlugin[] {
    return this.getAll().filter((t) => t.chapter === chapterId);
  }

  /** Tactics whose `canApply` accepts `node`. A throwing `canApply` counts as not applicable. */
  getAvailableTacticsForNode(node: MathNode, context?: TacticContext): TacticPlugin[] {
    return this.getAll().filter((t) => safeCanApply(t, node, context));
  }
}

export function safeCanApply(t: TacticPlugin, node: MathNode, context?: TacticContext): boolean {
  try {
    return t.canApply(node, context);
  } catch {
    return false;
  }
}

export const registry = new TacticRegistry();
