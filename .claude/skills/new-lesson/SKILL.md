---
name: new-lesson
description: >-
  Build or revise a Year 7 Cambridge lesson deck in this repo from Learner's
  Book pages. Use this whenever the user wants a lesson, a deck, or slides for
  a unit — including phrasings like "make Monday's maths lesson", "do 1.3",
  "build a deck from these pages", or when they attach a Learner's Book PDF or
  point at the Y7Books folder. Use it for revisions too ("the widget is
  overdesigned", "add a slide about X"), because the verification and deploy
  steps are identical. Covers the whole run: reading the book pages, the beat
  sheet, sourcing and crediting images, authoring diagrams, writing bilingual
  slides, the teacher plan, verification including project mode, and the
  deploy.
---

# Building a lesson

`docs/LESSON-PLAYBOOK.md` is the **design** authority — house style, layouts,
and why each rule exists. Read it before you author anything; this file will
not repeat it. What follows is the **sequence** and the tooling, in the order
that works.

The lesson is taught by Mr Bowen on a projector to Vietnamese ESL Year 7
students. They can do the arithmetic; what stops them is the English of the
question. That fact shapes every slide.

## 0 · Establish the facts before you build

Get these pinned down first — guessing any of them wastes the whole run.

- **Which unit, and which book pages.** The Y7Books folder holds per-section
  Science PDFs (`Y7Science1.2.pdf`) but a *whole-unit* Maths PDF
  (`Y7MathUnit01.pdf`) covering 1.1–1.6. For maths you must find the section
  inside it; do not assume the file is the section.
- **The teaching date**, for the hero's `date` field.
- **What already exists.** Read the most recent unit in `content/<course>/`
  end to end. Match its patterns; do not invent parallel ones. It is also your
  baseline for "how dense is too dense".

## 1 · Read the book pages

The PDFs are image-only scans with no text layer, roughly **115 dpi**
(955×1351 px per A4 page). PyMuPDF is installed.

```python
import fitz
d = fitz.open(path)
d[i].get_pixmap(dpi=200).save('pg.png')   # to read the page yourself
d.extract_image(d[i].get_images(full=True)[0][0])   # native pixels, to crop from
```

That resolution ceiling decides what you can reuse: **line art crops fine and
upscales acceptably; photographs printed in the book do not.** A micrograph
occupying a fifth of a page is ~250 px wide — too soft to project. Source an
openly-licensed equivalent instead and tell the class it is the same figure as
the book's. Illustrations that overlap body text cannot be cropped cleanly at
all; draw those.

Read every page before planning. Note the section's **Key words** (often only
one or two), the worked example, the exercise structure, and the questions —
the questions are usually the best classroom activities already written for
you.

## 2 · Write the beat sheet first

One line per slide, in teaching order, before any code. Mark which slides are
questions, which are copy-down, and which are Draw This.

This is where the lesson is actually designed, and it is cheap to change.
Structural mistakes found here cost a minute; found in `slides.js` they cost an
hour. Show it to the teacher if the shape is at all uncertain.

The shape that works, from the decks that have taught well:

- Open with a starter the class can do while settling.
- **Ask before you tell.** The question gets its own slide with no numbers on
  it. The gap between their guess and the answer is the lesson; showing the
  working first throws that away.
- Pair every drawn diagram with the real thing photographed.
- Stop for the English wherever a word is doing more work than it looks
  (*similar* ≠ *the same*; a *stain* on your shirt versus in a lab).
- End with a recap checklist that names the count — "your notebook should now
  have 7 written items and 1 labelled drawing" turns a vague instruction into a
  checkable one.

For **maths** specifically, language is the spine: teach the vocabulary of
change and comparison, drill sentence → calculation in both directions, use
**Mr Bowen** in worked examples rather than invented student names, and close
with word problems that get increasingly silly — presented completely deadpan,
never flagged as jokes.

## 3 · Source images, crediting as you go

Everything lives in the unit's `images/` and is **imported** in `slides.js`
(`import x from './images/x.jpg'`) so Vite hashes it and respects the
`/classroom/` base. Never hand-write a `/public/...` path.

Wikimedia Commons, via the API — check the licence **before** downloading,
send a real User-Agent, sleep ~1s between calls, pull a sane size with
`iiurlwidth` rather than the original, then downscale to ≤1200 px at quality
~80.

```
https://commons.wikimedia.org/w/api.php?action=query&format=json
  &list=search&srsearch=<terms>&srnamespace=6
https://commons.wikimedia.org/w/api.php?action=query&format=json
  &prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1400&titles=File:<name>
```

**Look at every image before you commit to it.** Search titles lie often
enough to matter: a promising "blood smear" turns out to be a photograph of the
glass slide, "leaf epidermis" turns out to be a scanning-electron image, and
"potato starch" turns out to be starch grains rather than cells. Roughly a
third of candidates get rejected on sight. Budget for that and download a few
extra.

Every file gets an entry in `images/CREDITS.json` with `name`, `title`,
`descUrl`, `license`, `artist`. If a textbook scan is used, say so explicitly
in the entry — licence `"(c) <publisher> - NOT openly licensed"` plus a `usage`
note — so a future reader knows it needs replacing before the site is shared
wider. Do not bury it.

## 4 · Author the diagrams

House style is in the playbook §5. The two rules that bite:

- **Open with a white plate** covering the viewBox, so artwork reads on a light
  *or* dark slide.
- **Write label `<text>` out literally.** `audit:svg` extracts template blocks
  and regexes for `<text>`; anything emitted from a `${helper(...)}` call is
  invisible to it, so the audit will cheerfully report "0 overflows" while
  measuring nothing. Use helpers for shapes and leader lines only.

Then **render a contact sheet and look at it** before wiring anything into
slides. Two gotchas: headless Chrome needs `--user-data-dir` or the screenshot
silently fails with "Access is denied", and the SVGs carry Tailwind classes
(`w-full h-full`) that do nothing in a bare HTML page — set
`svg { width: 100% !important; height: auto !important }` or every diagram
renders thumbnail-sized.

Label leader-lines are the thing you will get wrong: dots land inside the
shape, or point at the membrane when they mean the cytoplasm. Only the contact
sheet shows this.

## 5 · Write `slides.js`, bilingual from the start

Retro-fitting the `…Vn` twins is worse than writing them inline — you end up
re-reading every slide. Vietnamese also runs longer than English and overflows
different slides, so writing it late hides layout problems until the end.

The non-negotiables are in `CLAUDE.md`. The one worth restating because it is
the whole point of the deck: **anything a student must copy goes in a `write`
note or an orange `>` bumper, and nothing else does.** A definition that looks
like discussion prose does not get copied into a notebook.

Prefer the plain slide. A widget must do one thing a static slide cannot —
otherwise it is a note. This is the failure that recurs most; when in doubt,
build the simpler thing and offer the widget as a follow-up.

## 6 · Update `plan.js`

The teacher one-pager: duration, objective, materials, vocab, timeline,
answers, notes. A stale timeline is worse than none. Put the real answers in —
including the arithmetic for anything the deck asks the class to estimate, so
the teacher is not caught out at the board.

## 7 · Verify

```bash
npm run lint
npm run build
npm run audit:svg
npm run check:deck -- "http://localhost:5173/#/lesson/<course>/<unit>"
npm run check:deck -- "http://localhost:5173/#/lesson/<course>/<unit>" dark
node .claude/skills/new-lesson/scripts/slides-lint.mjs content/<course>/<unit>/slides.js
```

`slides-lint.mjs` catches what eslint cannot: a user-facing string with no
`…Vn` twin, and an unpaired `$` (balanced `$…$` pairs are real KaTeX and are
left alone).

Then **project mode**, which is what the class actually sees and which
`check:deck` does not test — it measures windowed, 1440×900, English:

```bash
node .claude/skills/new-lesson/scripts/project-check.mjs "<lesson-url>"
node .claude/skills/new-lesson/scripts/project-check.mjs "<lesson-url>" vn
WSIZE=1366,768 node .claude/skills/new-lesson/scripts/project-check.mjs "<lesson-url>"
WSIZE=1366,768 node .claude/skills/new-lesson/scripts/project-check.mjs "<lesson-url>" vn
```

Fullscreen swaps every layout to `clamp()` type ~40% larger, so a deck that is
spotless windowed can scroll on a third of its slides on the projector. Expect
to trim. Shortening prose is usually the fix; when a slide is over by more than
about 60 px, split it or move a note elsewhere rather than compressing until it
is terse.

Finally, look at it: screenshot the changed slides in **light and dark**, and
open any widget in each of its states. The reasoning here cannot be automated —
a widget can pass every check and still say "a an animal cell".

## 8 · Ship

Commit to `main`, `npm run deploy`, then confirm the live site is serving the
new bundle before calling it done:

```bash
grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html
curl -s https://bowenpra.github.io/classroom/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
```

GitHub Pages lags several minutes behind the `gh-pages` push, and the push
itself sometimes hangs — wrap it in `timeout` and check `git log origin/main`
rather than assuming it landed. Poll until the hashes match, then run
`check:deck` against the live URL. Images come off the network there, so let
them settle before judging broken-image counts.
