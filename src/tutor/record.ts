/**
 * What the pupil owns: evidence over rules, never a score. A rule is owned once he has used it
 * unprompted twice: written a line it makes, on a problem where he was not asked about it.
 * The record lives only in this browser.
 */

export type Kind = "unprompted" | "asked";

export interface Event {
  rule: string;
  kind: Kind;
  problem: string;
  at: number;
}

export interface Work {
  /** LaTeX source of each line the pupil entered, in order. */
  lines: string[];
  done: boolean;
}

export interface Book {
  version: 1;
  events: Event[];
  work: Record<string, Work>;
  slate: boolean;
}

const KEY = "elements:v1";

export const empty = (): Book => ({ version: 1, events: [], work: {}, slate: true });

export function load(): Book {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const b = JSON.parse(raw) as Book;
    return b && b.version === 1 ? { ...empty(), ...b } : empty();
  } catch {
    return empty();
  }
}

export function save(b: Book): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // A private window, or storage refused: the work goes on, unkept.
  }
}

export function note(b: Book, rule: string, kind: Kind, problem: string): void {
  b.events.push({ rule, kind, problem, at: Date.now() });
}

export function asked(b: Book, rule: string, problem: string): boolean {
  return b.events.some((e) => e.rule === rule && e.problem === problem && e.kind === "asked");
}

export function owns(b: Book, rule: string): boolean {
  const used = b.events.filter((e) => e.rule === rule && e.kind === "unprompted");
  return new Set(used.map((e) => e.problem)).size >= 2;
}

export function evidence(b: Book, rule: string): { unprompted: number; asked: number; first: number | null } {
  const es = b.events.filter((e) => e.rule === rule);
  const un = es.filter((e) => e.kind === "unprompted");
  return { unprompted: un.length, asked: es.length - un.length, first: un.length ? un[0].at : null };
}
