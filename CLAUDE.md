# CLAUDE.md

Elements: a copybook in Euler's school for one pupil (Richard's son), AoPS Pre-Algebra order.
Vite + TypeScript, no framework; mathjs (AST only) + KaTeX. The engine is algebra-moves'.

```
npm test         # vitest
npm run build    # tsc --noEmit && vite build
```

## Rules

1. **Never** `math.evaluate` or `math.simplify` in a move. Arithmetic is one operation at a time,
   in a rule. (`tutor/check.ts` computes values to judge a line, never to make one.)
2. **One line, one step**, judged by the engine's legal moves. A rule in two places at once
   stands; two different rules do not.
3. **The LaTeX reader reads as LaTeX sets.** What would print wrongly is refused with a note;
   what prints rightly but could be better is accepted with one.
4. **The school asks; it never gives the next line.** Its sentences are fixed templates
   (`tutor/voice.ts`). No words are put in Euler's mouth: quote his *Elements* only from the text.
5. **Not a score.** The record is evidence over rules (used unprompted, asked about). No XP, no
   stars, no levels.
6. **His alone.** The record lives in his browser. No server, no model, no analytics.
7. **The course's order, our own problems.** Tag a lesson with the AoPS chapter; never copy a
   book's exercises or text.
8. **Pushing to main publishes** to the site he uses. Work on a branch.

Commits end with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
