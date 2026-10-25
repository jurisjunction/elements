import katex from "katex";
import "katex/dist/katex.min.css";
import "./style.css";
import type { MathNode } from "mathjs";
import { isConst, replaceAt } from "../engine/ast";
import { toLatex } from "../engine/latex";
import { parseProblem } from "../engine/parse";
import { LESSONS, type Lesson, type Problem } from "../lessons/ch3";
import { readLine, type Note } from "../latex/reader";
import { rules, searchable } from "../rules/numbertheory";
import { intended, judge } from "../tutor/check";
import * as R from "../tutor/record";
import { masterMove, STATUS } from "../tutor/school";
import { FOUND, FOUND_GLOSS, opening, question, verdict } from "../tutor/voice";
import { Slate } from "./slate";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const tex = (src: string, display = false) =>
  katex.renderToString(src, { throwOnError: false, displayMode: display, strict: "ignore", output: "html" });

/** The school's and the compositor's sentences: `$…$` is mathematics, `…` is source. */
function rich(s: string): string {
  return s
    .split(/(\$[^$]+\$|`[^`]+`)/g)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$") && part.length > 1) return tex(part.slice(1, -1));
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part);
    })
    .join("");
}

const book = R.load();
let lesson: Lesson = LESSONS[0];
let problem: Problem = lesson.problems[0];
let slate: Slate | null = null;
let remark: { who: string; text: string } | null = null;

const lessonRules = () => rules.filter((r) => lesson.rules.includes(r.id));
const searchRules = () => searchable.filter((r) => lesson.rules.includes(r.id));
const isGoal = (n: MathNode) => isConst(n) && n.value === problem.goal;
const work = (): R.Work => (book.work[problem.id] ??= { lines: [], done: false });

/** The lines so far, read again from their source: the start, then each entered line. */
function lines(): { node: MathNode; src: string | null; said: string }[] {
  const out: { node: MathNode; src: string | null; said: string }[] = [
    { node: parseProblem(problem.start), src: null, said: "Given." },
  ];
  for (const src of work().lines) {
    const prev = out[out.length - 1].node;
    const r = readLine(src);
    if (!r.ok) break;
    const n = intended(prev, r.node, r.lhs);
    if (n === "elsewhere") break;
    const v = judge(prev, n, lessonRules());
    out.push({ node: n, src, said: v.kind === "one" || v.kind === "twice" ? v.rule.name + "." : "" });
  }
  return out;
}

function renderContents(): void {
  $("#contents").innerHTML = "<h2>Contents</h2>" + LESSONS.map((l) =>
    `<div class="lesson"><b><span>${l.numeral}.</span>${esc(l.title)}</b><ol>` +
    l.problems.map((p, k) => {
      const w = book.work[p.id];
      const cls = [p.id === problem.id ? "here" : "", w?.done ? "done" : ""].join(" ");
      return `<li><button class="${cls}" data-l="${l.id}" data-p="${p.id}" aria-label="Problem ${k + 1}: ${p.kind} of ${p.a} and ${p.b}">${k + 1}</button></li>`;
    }).join("") + "</ol></div>").join("");
  document.querySelectorAll<HTMLButtonElement>("#contents button").forEach((b) =>
    b.addEventListener("click", () => {
      lesson = LESSONS.find((l) => l.id === b.dataset.l)!;
      problem = lesson.problems.find((p) => p.id === b.dataset.p)!;
      remark = null;
      render();
      $("#page").scrollIntoView({ block: "start" });
    }));
}

function taskText(p: Problem): string {
  return p.kind === "lcm"
    ? `Find the least common multiple of ${p.a} and ${p.b}.`
    : `Find the greatest common divisor of ${p.a} and ${p.b}.`;
}

function renderPage(): void {
  const ls = lines();
  const w = work();
  const last = ls[ls.length - 1].node;
  const done = w.done || isGoal(last);
  if (done && !w.done) w.done = true;
  const k = lesson.problems.indexOf(problem) + 1;
  let html = `<h2><span class="sect">§ ${lesson.numeral}.</span>${esc(lesson.title)}</h2>
    <p class="tag">${esc(lesson.aops)}</p>
    <p class="problem-head">Problem ${k}.</p>
    <p class="task">${esc(taskText(problem))}</p>
    <p class="end"><span class="sc">The school asks first.</span> ${rich(opening(problem.kind, problem.a, problem.b))}</p>
    <ol class="working">` +
    ls.map((l, i) => `<li><span class="n">(${i})</span><span class="m">${i ? tex("= " + toLatex(l.node)) : tex(toLatex(l.node))}` +
      (l.src ? `<span class="copy">${esc(l.src)}</span>` : "") + `</span><span class="margin">${esc(l.said)}</span></li>`).join("") +
    `</ol>`;
  if (!done) {
    html += (book.slate ? `<div class="slate-wrap"><div class="label"><span>The slate · work line (${ls.length}) here first</span>
        <button class="link" id="wipe">Wipe the slate</button></div><canvas class="slate" id="slate" aria-label="The slate: write with a pen, a finger or the mouse"></canvas></div>` : "") +
      `<label class="typeset" for="src">Set line (${ls.length}) in type: LaTeX, math mode</label>
      <div class="compose"><span class="eq">=</span><input id="src" autocomplete="off" spellcheck="false" autocapitalize="off"
        placeholder="\\operatorname{lcm}(2^{2} \\cdot 3, 18)"></div>
      <div class="preview" id="preview"></div><div class="notes" id="notes"></div>
      <div class="bar"><button class="go" id="enter">Enter the line</button><button class="quiet" id="ask">Ask the school</button>
        ${w.lines.length ? '<button class="link" id="again">Begin again</button>' : ""}</div>
      <div id="remark">${remarkHTML()}</div>`;
  } else {
    html += `<div class="found"><b>${FOUND}</b><small>${esc(FOUND_GLOSS)}</small></div>` + schoolsWay() +
      `<div class="bar">${nextProblem() ? '<button class="go" id="next">The next problem</button>' : ""}<button class="link" id="again">Begin again</button></div>`;
  }
  $("#page").innerHTML = html;
  wire(done);
}

/** The way the school would have gone, from the start, for comparing after the work is done. */
function schoolsWay(): string {
  let node = parseProblem(problem.start);
  const steps: string[] = [];
  for (let i = 0; i < 14 && !isGoal(node); i++) {
    const c = masterMove(node, isGoal, searchRules());
    if (!c) break;
    const next = applyMove(node, c);
    steps.push(`<li>${tex("= " + toLatex(next))}<span class="r">${esc(c.rule.name)}</span></li>`);
    node = next;
  }
  return steps.length ? `<div class="way"><span class="sc">The school's way.</span> ${esc(STATUS)}.<ol>${steps.join("")}</ol></div>` : "";
}

/** The school's chosen move, made: the same rule on the same part of the same line. */
function applyMove(node: MathNode, c: NonNullable<ReturnType<typeof masterMove>>): MathNode {
  return replaceAt(node, c.move.path, c.rule.apply(c.node, c.move.params));
}

function nextProblem(): { l: Lesson; p: Problem } | null {
  const i = lesson.problems.indexOf(problem);
  if (i + 1 < lesson.problems.length) return { l: lesson, p: lesson.problems[i + 1] };
  const j = LESSONS.indexOf(lesson);
  return j + 1 < LESSONS.length ? { l: LESSONS[j + 1], p: LESSONS[j + 1].problems[0] } : null;
}

function remarkHTML(): string {
  return remark ? `<div class="remark"><span class="who">${esc(remark.who)}</span>${rich(remark.text)}</div>` : "";
}

function showNotes(notes: Note[]): void {
  $("#notes").innerHTML = notes.map((n) => `<p class="${n.kind}"><span class="sc">The compositor.</span> ${rich(n.text)}</p>`).join("");
}

function wire(done: boolean): void {
  $("#again")?.addEventListener("click", () => {
    book.work[problem.id] = { lines: [], done: false };
    remark = null;
    R.save(book);
    render();
  });
  if (done) {
    $("#next")?.addEventListener("click", () => {
      const n = nextProblem()!;
      lesson = n.l;
      problem = n.p;
      remark = null;
      render();
      $("#page").scrollIntoView({ block: "start" });
    });
    return;
  }
  const canvas = document.querySelector<HTMLCanvasElement>("#slate");
  slate = canvas ? new Slate(canvas) : null;
  $("#wipe")?.addEventListener("click", () => slate?.wipe());
  const input = $<HTMLInputElement>("#src");
  input.addEventListener("input", () => {
    const src = input.value;
    $("#preview").innerHTML = src.trim() ? tex(src.trim().replace(/^=\s*/, "= "), true) : "";
    showNotes(src.trim() ? readLine(src).notes : []);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enter(input.value);
    }
  });
  $("#enter").addEventListener("click", () => enter(input.value));
  $("#ask").addEventListener("click", ask);
}

function enter(src: string): void {
  const ls = lines();
  const prev = ls[ls.length - 1].node;
  if (book.slate && slate && !slate.inked) {
    remark = { who: "The school insists.", text: `Work line (${ls.length}) on the slate first, then set it in type.` };
    return keep(src);
  }
  const r = readLine(src);
  if (!r.ok) {
    remark = null;
    $("#remark").innerHTML = "";
    showNotes(r.notes);
    return;
  }
  const next = intended(prev, r.node, r.lhs);
  if (next === "elsewhere") {
    remark = { who: "The school.", text: "This line rewrites something that is not in the line above." };
    return keep(src);
  }
  const v = judge(prev, next, lessonRules());
  const said = verdict(v, (id) => R.owns(book, id));
  if (!said.stands) {
    remark = { who: "The school.", text: said.say };
    return keep(src);
  }
  const used = v.kind === "one" || v.kind === "twice" ? v.rule.id : null;
  if (used && !R.asked(book, used, problem.id)) R.note(book, used, "unprompted", problem.id);
  work().lines.push(src.trim());
  remark = said.say ? { who: "The school.", text: said.say } : null;
  R.save(book);
  render();
  document.querySelector<HTMLInputElement>("#src")?.focus();
}

/** Say the school's word without redrawing the page: the line stays in the box, the slate keeps
 * its chalk. */
function keep(_src: string): void {
  $("#remark").innerHTML = remarkHTML();
  document.querySelector<HTMLInputElement>("#src")?.focus();
}

function ask(): void {
  const ls = lines();
  const prev = ls[ls.length - 1].node;
  const c = masterMove(prev, isGoal, searchRules());
  const src = document.querySelector<HTMLInputElement>("#src")?.value ?? "";
  if (!c) {
    remark = { who: "The school asks.", text: "What is the next step?" };
    return keep(src);
  }
  R.note(book, c.rule.id, "asked", problem.id);
  R.save(book);
  const here = ls.length > 1 ? `In line (${ls.length - 1}): ` : "";
  remark = { who: "The school asks.", text: here + question(c.rule.id, c.node, R.owns(book, c.rule.id)) };
  keep(src);
}

function renderOwned(): void {
  const seen = new Set<string>();
  const rows = LESSONS.flatMap((l) => l.rules).filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => rules.find((r) => r.id === id)!)
    .map((r) => {
      const e = R.evidence(book, r.id);
      const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
      const state = R.owns(book, r.id) ? `<span class="own">his own</span>, first used unprompted ${new Date(e.first!).toLocaleDateString()}`
        : e.unprompted ? `used unprompted ${times(e.unprompted)}` : e.asked ? "" : "not yet met";
      const asked = e.asked ? `asked about ${times(e.asked)}` : "";
      return `<tr><td>${esc(r.name)}</td><td>${r.ruleLatex ? tex(r.ruleLatex) : ""}</td><td>${[state, asked].filter(Boolean).join("; ")}</td></tr>`;
    }).join("");
  $("#owned").innerHTML = `<h2>What he owns</h2>
    <p>Not a score. A rule is his once he has used it, unprompted, on two problems. This record is kept only in this browser.</p>
    <table><thead><tr><th>The rule</th><th>As written</th><th>The evidence</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="settings"><label><input type="checkbox" id="slate-rule" ${book.slate ? "checked" : ""}> The school insists on the slate before the type</label>
    <button class="link" id="forget">Forget the record</button></div>`;
  $<HTMLInputElement>("#slate-rule").addEventListener("change", (e) => {
    book.slate = (e.target as HTMLInputElement).checked;
    R.save(book);
    render();
  });
  const forget = $<HTMLButtonElement>("#forget");
  forget.addEventListener("click", () => {
    if (forget.dataset.sure !== "1") {
      forget.dataset.sure = "1";
      forget.textContent = "Forget it: press again to be sure";
      return;
    }
    Object.assign(book, R.empty());
    R.save(book);
    remark = null;
    render();
  });
}

function render(): void {
  renderContents();
  renderPage();
  renderOwned();
}

// Begin where he left off: the first problem not yet done.
const open = LESSONS.flatMap((l) => l.problems.map((p) => ({ l, p }))).find(({ p }) => !book.work[p.id]?.done);
if (open) {
  lesson = open.l;
  problem = open.p;
}
render();
