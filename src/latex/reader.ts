import type { MathNode } from "mathjs";
import { parseProblem, ParseError } from "../engine/parse";

/**
 * Read a line of LaTeX math mode, the small part of it a pupil needs here, as LaTeX itself
 * reads it, and say what a compositor would say about how it is set.
 *
 * Strictness is the lesson, as in the engine: `2^10` is read as LaTeX sets it (2¹0), not as the
 * pupil meant it; letters are letters (lcm unbraced is l·c·m in italics); spaces in math mode are
 * nothing, so `2 3` is 23. What LaTeX would set wrongly is refused with a note; what it sets
 * rightly but a compositor would set otherwise is accepted with one.
 */

export interface Note {
  kind: "error" | "style";
  /** The compositor's words. `code` spans are written `\`…\``. */
  text: string;
}

export type Reading =
  | { ok: true; node: MathNode; lhs: MathNode | null; notes: Note[] }
  | { ok: false; notes: Note[] };

type Tok =
  | { t: "num"; v: string; spaced: boolean }
  | { t: "letter"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "=" | "," }
  | { t: "open" | "close"; v: string }
  | { t: "lbrace" | "rbrace" }
  | { t: "sup" }
  | { t: "sub" }
  | { t: "cmd"; v: string };

const SPACING = new Set(["\\,", "\\;", "\\:", "\\!", "\\quad", "\\qquad", "\\ "]);
const OPERATOR_NAMES = new Set(["gcd", "lcm"]);

function tokenize(src: string, notes: Note[]): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  let sawSpace = false;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "~") {
      sawSpace = true;
      i++;
      continue;
    }
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      if (!m) {
        notes.push({ kind: "error", text: "A backslash at the end of the line starts a command that never comes." });
        return null;
      }
      const cmd = "\\" + m[1];
      i += cmd.length;
      if (SPACING.has(cmd)) {
        sawSpace = true;
        continue;
      }
      out.push({ t: "cmd", v: cmd });
      sawSpace = false;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      const prev = out[out.length - 1];
      if (prev && prev.t === "num" && sawSpace) {
        // Math mode ignores spaces: 2 3 is set as 23.
        prev.v += src.slice(i, j);
        prev.spaced = true;
      } else {
        out.push({ t: "num", v: src.slice(i, j), spaced: false });
      }
      i = j;
      sawSpace = false;
      continue;
    }
    sawSpace = false;
    if (/[A-Za-z]/.test(c)) out.push({ t: "letter", v: c });
    else if ("+-*/=,".includes(c)) out.push({ t: "op", v: c as "+" });
    else if (c === "(" || c === "[") out.push({ t: "open", v: c });
    else if (c === ")" || c === "]") out.push({ t: "close", v: c });
    else if (c === "{") out.push({ t: "lbrace" });
    else if (c === "}") out.push({ t: "rbrace" });
    else if (c === "^") out.push({ t: "sup" });
    else if (c === "_") out.push({ t: "sub" });
    else {
      notes.push({ kind: "error", text: `The character \`${c}\` has no place in this line.` });
      return null;
    }
    i++;
  }
  return out;
}

class Stop extends Error {}

/**
 * Turn tokens into an expression in the engine's own syntax, by LaTeX's grouping: a superscript
 * takes one token or one braced group, and a command takes its braced arguments.
 */
function translate(toks: Tok[], notes: Note[]): string {
  let i = 0;
  const err = (text: string): never => {
    notes.push({ kind: "error", text });
    throw new Stop();
  };
  const style = (text: string) => {
    if (!notes.some((n) => n.text === text)) notes.push({ kind: "style", text });
  };

  // One "atom" in LaTeX's sense: what a superscript or a command's argument takes.
  const group = (): string => {
    const t = toks[i];
    if (!t) return err("Something is missing at the end of the line: a `^` or a command needs what comes after it.");
    if (t.t === "lbrace") {
      i++;
      const inner = seq("rbrace");
      if (toks[i]?.t !== "rbrace") err("A `{` is never closed by its `}`.");
      i++;
      return `(${inner})`;
    }
    if (t.t === "num") {
      i++;
      if (t.v.length > 1) {
        // ^ takes one character: 2^10 is set 2¹0.
        const [first, rest] = [t.v[0], t.v.slice(1)];
        err(`As set, the exponent is only the \`${first}\`, and the \`${rest}\` follows on the line: \`^${t.v}\` prints as a small ${first} then ${rest}. Braces gather it into one exponent: \`^{${t.v}}\`.`);
      }
      return t.v;
    }
    if (t.t === "letter") {
      i++;
      return t.v;
    }
    if (t.t === "cmd") return command();
    return err("After `^`, put the exponent, in braces if it is more than one character: `^{10}`.");
  };

  const command = (): string => {
    const t = toks[i] as Extract<Tok, { t: "cmd" }>;
    i++;
    const v = t.v;
    if (v === "\\cdot" || v === "\\times" || v === "\\ast") return "*";
    if (v === "\\div") return "/";
    if (v === "\\gcd") return "gcd";
    if (v === "\\lcm") return err("LaTeX has no `\\lcm` command. Set the name upright with `\\operatorname{lcm}`.");
    if (v === "\\operatorname" || v === "\\mathrm" || v === "\\text" || v === "\\textrm") {
      if (toks[i]?.t !== "lbrace") err(`\`${v}\` takes its name in braces: \`${v}{lcm}\`.`);
      i++;
      let name = "";
      while (toks[i] && toks[i].t === "letter") name += (toks[i++] as { v: string }).v;
      if (toks[i]?.t !== "rbrace") err(`\`${v}{…}\` holds only the letters of a name here.`);
      i++;
      if (!OPERATOR_NAMES.has(name)) return err(`\`${name}\` is not a name this page knows; it knows \`gcd\` and \`lcm\`.`);
      if (name === "gcd") style("LaTeX has `\\gcd` built in; it is shorter than spelling it out.");
      if (v !== "\\operatorname") style(`\`\\operatorname{${name}}\` spaces an operator's name as an operator; \`${v}\` sets it as plain upright letters.`);
      return name;
    }
    if (v === "\\frac" || v === "\\dfrac" || v === "\\tfrac") {
      const top = group();
      const bottom = group();
      return `((${top})/(${bottom}))`;
    }
    if (v === "\\left" || v === "\\right") {
      const d = toks[i];
      if (!d || (d.t !== "open" && d.t !== "close")) err(`\`${v}\` needs a bracket after it: \`${v}(\`.`);
      return "";
    }
    return err(`\`${v}\` is not a command this page knows. It knows \`\\cdot\`, \`\\times\`, \`\\div\`, \`\\frac\`, \`\\gcd\` and \`\\operatorname{lcm}\`.`);
  };

  const startsOperand = (t: Tok | undefined) =>
    !!t && (t.t === "num" || t.t === "letter" || t.t === "open" || t.t === "lbrace" ||
      (t.t === "cmd" && ["\\gcd", "\\operatorname", "\\mathrm", "\\text", "\\textrm", "\\frac", "\\dfrac", "\\tfrac", "\\lcm"].includes(t.v)) ||
      (t.t === "cmd" && t.v === "\\left"));

  // A run of terms and operators up to `until` (a closing token) or the end.
  const seq = (until?: "rbrace" | "close"): string => {
    let out = "";
    let afterOperand = false;
    let letters = "";
    const flushLetters = () => {
      if (letters.length > 1 && OPERATOR_NAMES.has(letters.toLowerCase())) {
        err(`Unbraced, \`${letters}\` is set as ${letters.length} letters in italics, ${[...letters].join(" · ")}, a product. An operator's name is set upright: ${letters === "gcd" ? "`\\gcd`" : "`\\operatorname{lcm}`"}.`);
      }
      letters = "";
    };
    while (i < toks.length) {
      const t = toks[i];
      if (until && t.t === until) break;
      if (t.t === "close" && until !== "close") {
        if (until === "rbrace") err("A `)` closes a bracket that was never opened inside these braces.");
        break;
      }
      if (startsOperand(t) && afterOperand) {
        out += "*";
      }
      if (t.t === "letter") letters += t.v;
      else flushLetters();
      if (t.t === "num") {
        i++;
        if (t.spaced) style(`Math mode ignores spaces, so this is set as one number, ${t.v}. Between two numbers, write \`\\cdot\` for a product.`);
        out += t.v;
        afterOperand = true;
      } else if (t.t === "letter") {
        i++;
        if (t.v === "x" && afterOperand && toks[i] && (toks[i].t === "num")) {
          err("Here `x` is the letter x, set in italics. The times sign is `\\times`, or `\\cdot`.");
        }
        out += t.v;
        afterOperand = true;
      } else if (t.t === "op") {
        i++;
        if (t.v === "*") style("A star is a computer's sign. In print, a product is set with `\\cdot` (or `\\times`).");
        if (t.v === "/") style("In a line of working, `\\div` or a fraction `\\frac{a}{b}` reads better than a slash.");
        if (t.v === "=") err("One line holds one expression; a second `=` begins another line.");
        out += t.v;
        afterOperand = false;
      } else if (t.t === "open") {
        i++;
        const inner = seq("close");
        if (toks[i]?.t !== "close") err("A `(` is never closed by its `)`.");
        i++;
        out += `(${inner})`;
        afterOperand = true;
      } else if (t.t === "lbrace") {
        out += group();
        afterOperand = true;
      } else if (t.t === "sup") {
        i++;
        if (!afterOperand) err("A `^` needs a base before it.");
        out += `^${group()}`;
        afterOperand = true;
      } else if (t.t === "sub") {
        err("Subscripts are not needed in these lines.");
      } else if (t.t === "cmd") {
        const s = command();
        out += s;
        // An operator or a function's name wants what follows; \left and \right change nothing;
        // a fraction is a whole operand.
        if (s === "*" || s === "/" || OPERATOR_NAMES.has(s)) afterOperand = false;
        else if (s !== "") afterOperand = true;
      } else {
        err("A `}` closes a brace that was never opened.");
      }
    }
    flushLetters();
    return out;
  };

  const s = seq();
  if (i < toks.length) err("A `)` or `}` closes something that was never opened.");
  return s;
}

/** Read one line. A leading `=` is a continuation (the line above equals this one); `A = B`
 * reads A as what the line claims to start from and B as the new line. */
export function readLine(src: string): Reading {
  const notes: Note[] = [];
  const text = src.trim().replace(/^\$+|\$+$/g, "").trim();
  if (!text) return { ok: false, notes: [{ kind: "error", text: "The line is empty." }] };
  const toks = tokenize(text, notes);
  if (!toks) return { ok: false, notes };
  const parts: Tok[][] = [[]];
  let depth = 0;
  for (const t of toks) {
    if (t.t === "open" || t.t === "lbrace") depth++;
    if (t.t === "close" || t.t === "rbrace") depth--;
    if (t.t === "op" && t.v === "=" && depth === 0) parts.push([]);
    else parts[parts.length - 1].push(t);
  }
  if (parts.length > 2) {
    return { ok: false, notes: [{ kind: "error", text: "One line holds one step: an `=` at its start, or one `=` between the line above and the new one." }] };
  }
  try {
    const exprs = parts.map((p) => (p.length ? translate(p, notes) : ""));
    const right = exprs[exprs.length - 1];
    if (!right) return { ok: false, notes: [...notes, { kind: "error", text: "Nothing follows the `=`." }] };
    const node = parseProblem(right);
    const lhs = parts.length === 2 && exprs[0] ? parseProblem(exprs[0]) : null;
    return { ok: true, node, lhs, notes };
  } catch (e) {
    if (e instanceof Stop) return { ok: false, notes };
    if (e instanceof ParseError) return { ok: false, notes: [...notes, { kind: "error", text: e.message }] };
    throw e;
  }
}
