# Elements

A copybook in Euler's school: divisors and multiples, one line at a time. Each line is one step,
by one named rule. Each line is set in LaTeX math mode, the way mathematics is printed. And each
line is worked first on the slate, by hand.

**Use it:** https://jurisjunction.github.io/elements/ (what he has done is kept in his browser).

The lessons follow the order of AoPS *Pre-Algebra*, Chapter 3 (Number Theory): least common
multiples, greatest common divisors, Euclid's way for larger numbers, and the two together. The
problems are this copybook's own.

## How a line is taken

1. **The slate.** Work the line by hand: a pen on a drawing tablet, a finger, or the mouse. The
   school insists on it (a setting turns it off). Nothing written there leaves the page.
2. **The type.** Set the line in LaTeX: `\operatorname{lcm}(2^{2} \cdot 3, 18)`. The page reads it
   as LaTeX does. `2^10` is a small 1 followed by a 0, and an unbraced `lcm` is three italic
   letters. The compositor says what is set wrongly, and what is set rightly but could be better.
   A side working, `12 = 2^{2} \cdot 3`, rewrites that part of the line above.
3. **The school.** The line stands when one rule takes the line above to it, and the margin names
   the rule. The same rule in two places at once (factoring both numbers) stands too. Two
   different steps in one line do not: the school asks for the first. A true line that no rule
   reaches is asked about, not called false.
4. **Ask the school.** One question, never the answer. It names the idea if the rule is new to him,
   and only points if it is his.
5. **Q.E.I.**, *quod erat inveniendum*: which was to be found. Then the school's way is shown beside
   his, for comparing.

**What he owns** is a record of rules, not a score. A rule is his once he has used it
unprompted on two problems.

## Euler's school

Among the legal moves, the school chooses the one a master would take. Today that is a stated
guess (`src/tutor/school.ts`): factor what can be factored at sight, take Euclid's way for numbers
too large for that. The plan is to read Euler's worked examples in his *Elements of Algebra*
(1770, public domain) into lines of moves, confirm each, and fit the weights on them, as Beat Your
Bot's are fitted on Morphy's games.

## Code

```
npm install
npm run dev      # http://localhost:5173
npm test         # the rules, the reader, the judge, the school, the lessons
npm run build
```

```
src/engine/    from algebra-moves: parse, match, rewrite, the legal moves, the search, LaTeX
src/rules/     the rules of the lessons (numbertheory.ts)
src/latex/     the LaTeX reader and the compositor's notes
src/tutor/     the judge of a line, the school, the record, the voice
src/lessons/   the lessons, in the course's order
src/ui/        the page and the slate
```

Every push to `main` tests, builds and publishes to GitHub Pages. No model and no server are
involved; the record lives only in the browser.

## Licence

Copyright Luktor Labs. PolyForm Noncommercial 1.0.0; see `LICENSE`.
