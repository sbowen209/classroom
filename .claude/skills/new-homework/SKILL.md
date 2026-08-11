---
name: new-homework
description: >-
  Build or revise a printed Year 7 homework packet for this repo — a LaTeX
  document compiled to PDF, covering one or more lesson units. Use this whenever
  the user wants homework, a worksheet, a problem sheet, a practice packet, or a
  PDF for students to write on — including phrasings like "make homework for 1.1
  and 1.2", "a worksheet on integers", "something to hand out Friday". Use it
  for revisions too ("cut the last question", "get it down to 6 pages", "this
  looks too dense"), because the build-and-look loop is identical. Covers what
  goes in a packet, the house style, the LaTeX traps, the render-and-inspect
  verification, and hitting a page target without leaving holes.
---

# Building a homework packet

A packet is a **printed PDF the student writes on**, not a deck. It has no
Vietnamese twin strings, no widgets, and no dark mode — but it inherits the
decks' palette, the Learner's Book look, and above all the reason the decks
exist: **this class can do the arithmetic, and the English of the question is
what stops them.**

Read `CLAUDE.md` first for the house non-negotiables that apply everywhere
(Mr Bowen in worked examples, no invented student names, never put a `$` in
prose you might later paste into a slide). `docs/LESSON-PLAYBOOK.md` is about
decks and does **not** govern this; the design rules for packets are below.

## 0 · Ask before you build

The teacher's answers change the whole shape, and a wrong packet is expensive.
Pin down, up front:

- **Which units.** Usually one maths and one science section, maths first.
- **Page target.** Ask if it is not given. Eight sides is the working default —
  it prints as two double-sided sheets.
- **Anything to leave out**, and whether a take-home practical task is wanted.

Then say what you plan to include before writing 500 lines of LaTeX. Structural
changes are free at that point.

## 1 · Where it lives, and how it builds

```
homework/
  hw-style.tex          <- shared house style. Do not fork it.
  hw01/
    hw01.tex            <- the packet
    hw01.pdf            <- student copy
    hw01-teacher.pdf    <- + answer key
    README.md
```

A packet is `\documentclass`, the answer-key switch, `\input{../hw-style.tex}`,
a `\fancyhead[L]` override, and then the questions. Copy `hw01/hw01.tex` and
delete its body — that is the template.

**Build and look in one command:**

```bash
pwsh .claude/skills/new-homework/scripts/build-hw.ps1 hw01
```

It builds both copies, reports errors and overfull boxes, prints a page-density
bar chart, and rasterises every page to `<packet>/.preview/p-N.png`.

MiKTeX is installed per-user at `%LOCALAPPDATA%\Programs\MiKTeX\miktex\bin\x64`
and is **not on PATH** in a fresh shell; the script prepends it. Package
auto-install is on, so a new `\usepackage` just works. `pdftoppm` ships with
MiKTeX — you do not need poppler.

If MiKTeX is ever missing:
`winget install --id MiKTeX.MiKTeX --scope user --accept-package-agreements`

## 2 · What goes in a packet

The maths section is a **language** exercise wearing arithmetic. Reuse the
traps from the deck with new numbers and new contexts; do **not** copy
questions out of the workbook — the workbook is set separately and duplicating
it wastes the homework.

The sequence that works:

- Place something on a number line. Keep this one genuinely easy: it is the
  question that tells a struggling student they can start.
- A block of bare calculations covering all four movement rules.
- **English → calculation**, with the calculation marked as the thing to write
  first. This is the heart of the maths section.
- Difference, including the pair that looks identical and is not
  (*the difference between −5 and 6* versus *−5 minus 6*).
- Word problems with room to work.
- **Calculation → English.** Give them an expression in a box and make them
  write the word problem that matches it. This is the best critical-thinking
  question in the format: it cannot be answered by pattern-matching, it forces
  the signal vocabulary to be used rather than recognised, and it exposes the
  "which number comes first" confusion better than any forward question. Set
  explicit conditions (real context, a signal word, full sentences, ends in a
  question, produces the given answer) so it is markable.

The science section: vocabulary match, a tick table, **full-sentence** answers
with sentence starters supplied, a label-the-diagram, and a model question.
Insist on sentences and say why on the cover — *"Chloroplast" is not a
sentence; "The green circles are chloroplasts" is.*

Two standing rules:

- **Every language trap gets a blue Word help box** on the same page. Glossing
  *subtract X from Y*, *deposit*, *withdraw*, *owe*, *descend* is not
  hand-holding; it is the subject being taught.
- **Deadpan silly is welcome** in the last word problem — but check the answer
  does not depend on a fact the deck never taught. A question that lands on
  37 °C and asks "what is this the temperature of?" is only fair if body
  temperature has actually come up in class.

## 3 · House style, and why

All of it is in `homework/hw-style.tex`. If a packet seems to need something
different, the real question is whether *every* packet should have it.

- **No marks, no mark totals.** These are practice, not exam papers. Removing
  them also removes a whole class of arithmetic error in your own work.
- **No solid dark banners.** Headers are a light tint with a fat coloured spine
  on the left. A big block of solid colour at the top of a page costs real
  toner on a school printer for no teaching benefit.
- **Lato 12pt, open leading, generous writing lines.** The failure mode to
  avoid is a sheet that looks like a university problem set. If it looks dense,
  it is dense.
- **`mathastext` is not optional.** Without it every `-6 + 4` renders in
  Computer Modern serif against Lato body text and the sheet looks
  half-typeset. It must be loaded **last**.
- Colour meanings match the decks: teal sections, orange = must know,
  blue = English help, purple = instructions, green = your turn.

## 4 · LaTeX traps that have already cost time

- **`\marks` is a TeX primitive.** Naming a macro that fails with a confusing
  "already defined" error.
- **`titlesec` refuses `#1` in its before-code here** — you get "Illegal
  parameter number in `\ttlf@section`" and stray `#` in horizontal mode. The
  style file hand-rolls `\hwsection` instead. Do not reintroduce titlesec.
- **Keep the source pure ASCII.** Write `---`, `\textperiodcentered`,
  `\ldots`. Windows PowerShell's `Set-Content` will happily double-encode a
  UTF-8 file into mojibake if you ever run a regex over it; ASCII is immune.
  For the same reason, prefer the Edit tool over PowerShell text substitution
  on `.tex` files.
- **`tabularx` with `@{}` on a ruled table** puts the outer vertical rules
  outside the text block, so the right border prints off the edge. Use
  `{|X|p{3.1cm}|...|}` and give every fixed column an explicit width, or the
  last header gets crushed.
- **Do not redirect a native exe's stderr with `2>&1` in PowerShell 5.1.** Each
  line becomes an ErrorRecord and MiKTeX's "you have not checked for updates"
  nag aborts the script.
- **Anything a PowerShell function writes to the output stream becomes its
  return value.** Use `Write-Host` for reporting.

## 5 · Verify by looking. There is no substitute.

**Every single layout defect in this format has been found by rasterising the
PDF and reading the image — none by reading the log.** A clean log with zero
overfull boxes has shipped: a leader line pointing at the wrong organelle, two
tables bleeding past the right margin, a heading stranded alone at the foot of
a page, and three pages two-thirds empty.

So: run the build script, then **Read the PNGs**. Every page, first time
through; the changed pages and their neighbours on a revision.

What to look for, in order:

1. **Anything past the margin** — tables and wide headers.
2. **Diagram leader lines.** Does each one end on an unambiguous target? Give
   every leader a dot at its endpoint and keep clutter away from where it
   lands. Two structures that are conceptually easy to confuse (cell wall
   versus membrane) must be visually far apart, not adjacent lines.
3. **Half-empty pages.** The density chart flags them; the PNG shows why.
4. **Room to write.** Table rows need `\rule{0pt}{1.9em}` or students get a
   3 mm slot for "cell membrane".

## 6 · Hitting a page target without leaving holes

Page breaks are the fiddly part. In order of effectiveness:

- **Move the atomic block last.** A full-page item that cannot be broken — a
  labelled diagram plus its answer lines — strands a third of a page wherever
  it sits mid-section. Put it at the end of its section and renumber. This
  saved a full page and is the single biggest win available.
- **Keep groups atomic on purpose.** Answer lines that belong to a diagram go
  in a `tabular`, not `multicols` or `enumerate`, so they cannot split away
  from it.
- **Do not over-use `needspace`.** 6 baselineskips for a question heading, 8
  for a section heading. Larger values push headings to the next page and open
  a bigger hole than they prevent. This is counter-intuitive and was got wrong
  once already.
- A `breakable` tcolorbox still moves whole if there is not enough room to
  start it. A heading followed by a big box is the usual cause of a short page;
  shortening what precedes it fixes it, tuning the box does not.
- Only then reach for leading, margins, and column counts. In a 3-column
  layout, check no expression wraps — shorten the expression rather than
  widening the column.

Spend any leftover space on the last page **giving students more room to
write**, not on shrinking the packet further.

## 7 · The answer key

One source, two PDFs. `\ifdefined\TEACHER` at the top of the packet:

```bash
pdflatex -jobname=hw01-teacher "\def\TEACHER{}\input{hw01.tex}"
```

The key is for an adult at a desk, so it resets `\linespread` and list spacing
to something compact.

**Write the diagnosis, not just the answer.** The answer alone is the least
useful part — the teacher already knows it. What earns its place: which wrong
answer to expect and what it means (*"if a student writes 9 − 4, that is the
English error, not an arithmetic one — make them re-read the sentence"*), which
question the class will collectively fail and should be discussed rather than
marked, and, for open questions, the conditions to check in order.

## 8 · When the teacher asks for changes

- **Quote back exactly what you removed.** "Remove the first bank account
  question" can point at more than one question; naming the one you cut lets a
  misread be corrected in one line instead of a rebuild.
- **Check what a cut takes with it.** Removing a question can remove the only
  place a concept is tested. Say so and keep a smaller version elsewhere, or
  flag it.
- Rebuild, re-render, re-read. A cut two pages earlier moves every page break
  after it.
