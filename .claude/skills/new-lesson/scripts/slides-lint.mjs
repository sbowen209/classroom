/**
 * Static checks on a unit's slides.js that eslint cannot see.
 *
 *   node slides-lint.mjs content/y7-science/U01_2/slides.js
 *
 * Two failures this catches, both of which ship silently:
 *
 *  1. A user-facing string with no `…Vn` twin. Half the class reads the
 *     Vietnamese; a missing twin silently falls back to English mid-slide.
 *  2. An UNBALANCED `$`. `parseInlineText` splits on /(\$[\s\S]+?\$)/ to find
 *     KaTeX, so dollar signs pair up greedily. Balanced pairs are fine and the
 *     maths decks rely on them — but an odd number of `$` in a string means
 *     one of them will either pair with the wrong partner and swallow the
 *     words between, or render as a stray. Currency is the usual culprit:
 *     write "20 dollars". An escaped `\$` does not help; it prints the
 *     backslash and still counts.
 *
 * slides.js imports diagrams, widgets (.jsx) and images, none of which node
 * can load directly — so the imports are stripped and every imported
 * identifier is replaced with a permissive stub before evaluating.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'

const target = process.argv[2]
if (!target) {
  console.error('usage: node slides-lint.mjs <path-to-slides.js>')
  process.exit(2)
}
const src = fs.readFileSync(target, 'utf8')

// Collect every identifier the file imports, so each can be stubbed.
const ids = []
for (const m of src.matchAll(/^import\s+([^'"]+?)\s+from\s+['"][^'"]+['"];?\s*$/gm)) {
  const clause = m[1].trim()
  const named = /\{([^}]*)\}/.exec(clause)
  if (named) {
    for (const part of named[1].split(',')) {
      const id = part.split(/\s+as\s+/).pop().trim()
      if (id) ids.push(id)
    }
  }
  const dflt = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim()
  if (dflt && /^[A-Za-z_$][\w$]*$/.test(dflt)) ids.push(dflt)
}

// A stub that is callable, indexable and stringifiable, so `DIAGRAMS.FOO`,
// `widget: SomeWidget` and `image: someJpg` all behave.
const stub = ids
  .map((id) => `const ${id} = new Proxy(function () {}, { get: () => 'stub' });`)
  .join('\n')
const body = src.replace(/^import\s+[^'"]+?from\s+['"][^'"]+['"];?\s*$/gm, '')

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slides-lint-')), 'slides.mjs')
fs.writeFileSync(tmp, `${stub}\n${body}`)
const { slides } = await import(pathToFileURL(tmp).href)

// Identifier/styling fields carry no prose, so they need no translation.
const SKIP = new Set([
  'layout', 'accent', 'color', 'icon', 'labelIcon', 'tone', 'columns', 'ratio',
  'side', 'variant', 'drawThis', 'inlineSvg', 'image', 'widget', 'date',
])

const problems = []
const walk = (node, at) => {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${at}[${i}]`))
  if (!node || typeof node !== 'object') return
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') { walk(v, `${at}.${k}`); continue }
    if (typeof v !== 'string') continue
    // Balanced $…$ pairs are real KaTeX and are fine. An odd count is not.
    // Count per line: parseInlineText works line by line via renderContent.
    v.split('\n').forEach((line, ln) => {
      const at2 = `${at}.${k}${v.includes('\n') ? `:${ln + 1}` : ''}`
      if (line.includes('\\$')) problems.push(`ESCAPED-$ ${at2} — "${line.slice(0, 54)}"`)
      const n = (line.match(/\$/g) || []).length
      if (n % 2 === 1) problems.push(`UNPAIRED-$ ${at2} — "${line.slice(0, 54)}"`)
    })
    if (k.endsWith('Vn') || SKIP.has(k)) continue
    if (!(`${k}Vn` in node)) problems.push(`NO-VN    ${at}.${k} — "${v.slice(0, 48)}"`)
  }
}
slides.forEach((s, i) => walk(s, `slide${i + 1}`))

fs.rmSync(path.dirname(tmp), { recursive: true, force: true })

if (problems.length) {
  console.log(problems.join('\n'))
  console.log(`\n${slides.length} slides checked, ${problems.length} problem(s)`)
  process.exit(1)
}
console.log(`${slides.length} slides checked — every string has a Vn twin, every $ is paired`)
