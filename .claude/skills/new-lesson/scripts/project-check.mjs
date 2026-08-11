/**
 * Project-mode overflow check.
 *
 * `npm run check:deck` measures the deck WINDOWED at 1440x900 in English.
 * The lesson is taught FULLSCREEN, where every layout swaps to clamp() type
 * roughly 40% larger. A deck can be spotless in check:deck and still scroll on
 * a third of its slides in front of the class, so this has to be checked
 * separately — in both languages, at the room's real resolution.
 *
 *   node project-check.mjs <lesson-url> [vn]
 *   WSIZE=1366,768 node project-check.mjs <lesson-url> vn
 *
 * Two things make this awkward, both handled below:
 *   1. Project mode calls requestFullscreen(), which needs a TRUSTED user
 *      gesture. el.click() from injected JS is not one — the click has to be
 *      dispatched through CDP as a real mouse event.
 *   2. Headless Chrome ignores --window-size here (it reports 800x600 and
 *      everything looks broken). Set the viewport with
 *      Emulation.setDeviceMetricsOverride — and set it AGAIN after entering
 *      fullscreen, which resets the override.
 *
 * Baseline before panicking: a deck that teaches fine can still overflow a
 * slide at 1366x768. Run this against a known-good unit to calibrate.
 */
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const [URL_ARG, ...flags] = process.argv.slice(2)
if (!URL_ARG) {
  console.error('usage: node project-check.mjs <lesson-url> [vn]   (env: WSIZE=1920,1080)')
  process.exit(2)
}
const VN = flags.includes('vn')
const [VW, VH] = (process.env.WSIZE || '1920,1080').split(',').map(Number)
const PORT = Number(process.env.PORT || 9455)

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const chromePath = CANDIDATES.find((p) => fs.existsSync(p))
if (!chromePath) { console.error('No Chrome found. Set CHROME=/path/to/chrome'); process.exit(2) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-check-'))
const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' })
const cleanup = () => {
  try { chrome.kill() } catch { /* already gone */ }
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* best effort */ }
}
process.on('exit', cleanup)

let targets = null
for (let i = 0; i < 40 && !targets; i++) {
  await sleep(250)
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json() } catch { /* not up yet */ }
}
if (!targets) { console.error('Chrome did not start'); cleanup(); process.exit(2) }

const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
}
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId
  pending.set(id, res)
  ws.send(JSON.stringify({ id, method, params }))
})
const evalJs = async (expression, awaitPromise = true) =>
  (await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }))?.result?.value

const metrics = () => send('Emulation.setDeviceMetricsOverride', {
  width: VW, height: VH, deviceScaleFactor: 1, mobile: false,
})

await send('Page.enable')
await send('Runtime.enable')
await metrics()
await send('Page.navigate', { url: URL_ARG })
await sleep(2600)

if (VN) {
  await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'vn'); if (b) b.click(); return 1 })()`, false)
  await sleep(400)
}

const rect = await evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /project/i.test(x.textContent.trim()));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
})()`, false)
if (!rect) { console.error('No PROJECT button found — is this a lesson URL?'); cleanup(); process.exit(2) }

// A trusted gesture: synthetic el.click() will not satisfy requestFullscreen().
for (const type of ['mousePressed', 'mouseReleased']) {
  await send('Input.dispatchMouseEvent', { type, x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
}
await sleep(1200)
await metrics() // fullscreen resets the override
await sleep(600)

const on = await evalJs('!!document.fullscreenElement', false)
const size = await evalJs('window.innerWidth + "x" + window.innerHeight', false)
if (!on) { console.error('Could not enter project mode'); cleanup(); process.exit(2) }
console.log(`project mode: ${size}, ${VN ? 'VN' : 'EN'}`)

const rows = await evalJs(`(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const out = [];
  let last = null;
  for (let i = 1; i <= 40; i++) {
    await wait(520);
    if (!location.hash.includes('/lesson/')) break;
    const title = ((document.querySelector('h1,h2') || {}).textContent || '(none)').trim();
    if (title === last && i > 1) break;
    last = title;
    let over = 0;
    document.querySelectorAll('div').forEach((el) => {
      if (!/auto|scroll/.test(getComputedStyle(el).overflowY)) return;
      const o = el.scrollHeight - el.clientHeight;
      if (o > over) over = o;
    });
    out.push(String(i).padStart(2) + '  ' + title.slice(0, 34).padEnd(36) + (over > 16 ? 'OVERFLOW ' + over + 'px' : 'ok'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
  return out.join('\\n');
})()`)

console.log(rows)
const bad = rows.split('\n').filter((r) => r.includes('OVERFLOW')).length
console.log(`\n${VN ? 'VN' : 'EN'} @ ${size}: ${bad} slide(s) overflowing`)
ws.close()
cleanup()
process.exit(bad ? 1 : 0)
