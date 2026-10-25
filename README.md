# Elements

A copybook in Euler's school: divisors and multiples, one line at a time. Each line is one step,
by one named rule. Each line is set in LaTeX math mode, the way mathematics is printed. And each
line is worked first on the slate, by hand.

**Use it:** https://jurisjunction.github.io/elements/ (what he has done is kept in his browser).

The lessons follow the order of AoPS *Pre-Algebra*, Chapter 3 (Number Theory): least common
multiples, greatest common divisors, Euler's way for any two numbers, and the two together. The
problems are this copybook's own, except Lesson III, which opens with Euler's own four examples,
his words on what the greatest common divisor is for, and his rule.

## How a line is taken

1. **The slate.** Work the line by hand: a pen on a drawing tablet, a finger, or the mouse. The
   school insists on it (a setting turns it off). Nothing written there leaves the page.
2. **The type.** Set the line in LaTeX: `\operatorname{lcm}(2^{2} \cdot 3, 18)`. The page reads it
   as LaTeX does. `2^10` is a small 1 followed by a 0, and an unbraced `lcm` is three italic
   letters. The compositor says what is set wrongly, and what is set rightly but could be better.
   A side working, `12 = 2^{2} \cdot 3`, rewrites that part of the line above.
3. **The school.** The line stands when one rule takes the line above to it, and the margin names
   the rule. The same rule in two places at once (factoring both numbers) stands too. Two
   different steps in one line do not, nor the same rule done again on what it gave (two
   divisions in one line): the school asks for the first. A true line that no rule reaches is
   asked about, not called false.
4. **Ask the school.** One question, never the answer. It names the idea if the rule is new to him,
   and only points if it is his.
5. **Q.E.I.**, *quod erat inveniendum*: which was to be found. Then the school's way is shown beside
   his, for comparing. On one of Euler's examples, Euler's own working is shown instead, laid out
   as he printed it, with what he said it came to.

**What he owns** is a record of rules, not a score. A rule is his once he has used it
unprompted on two problems.

## Euler's school

Among the legal moves, the school chooses the one a master would take, weighed from Euler's own
worked examples, as Beat Your Bot's weights are read from Morphy's games. His chapter on the
greatest common divisor (*Elements of Algebra*, Part I, Sect. III, Ch. VII, §449–460; public
domain) is read into lines, one division to a line (`src/euler/gcd.ts`), and the tests check every
line is one legal step that ends at his answer. At each line the school counts which rules were
open and which one he took:

| Rule | Open | He took it | Weight |
|---|---|---|---|
| Euclid's step | 17 | 17 | 95 |
| The GCD with 0 | 4 | 4 | 83 |
| GCD: the shared primes to their lowest power | 2 | 0 | 25 |
| Write as a product of primes | 18 | 0 | 5 |
| The order does not matter (GCD) | 21 | 0 | 4 |

A weight is 100 · (taken + 1) / (open + 2), so four examples do not make a certainty. A rule his
examples never offer keeps a stated guess, and the page says which are which. The school takes the
first move of the way he would most likely go, each move costing −ln(weight); a circle always
costs more, so it is never taken. He never factors in these examples, so where Euclid's step is
allowed the school divides, even for small numbers; where it is not (Lessons I and II), it factors.

Next: his other chapters, read the same way.

## Code

```
npm install
npm run dev      # http://localhost:5173
npm test         # the rules, the reader, the judge, the school, the lessons, Euler's lines
npm run build
```

```
src/engine/    from algebra-moves: parse, match, rewrite, the legal moves, the search, LaTeX
src/rules/     the rules of the lessons (numbertheory.ts)
src/latex/     the LaTeX reader and the compositor's notes
src/tutor/     the judge of a line, the school, the record, the voice
src/lessons/   the lessons, in the course's order
src/euler/     Euler's worked examples, his words (cited by section) and his layout
src/ui/        the page and the slate
```

Every push to `main` tests, builds and publishes to GitHub Pages. No model and no server are
involved; the record lives only in the browser.

## Licence

Copyright Luktor Labs. PolyForm Noncommercial 1.0.0; see `LICENSE`.
