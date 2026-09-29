#!/usr/bin/env node
/**
 * record-wallet-shot.mjs — guided recorder for the wallet-flow shot.
 *
 * YOU:  1. quit Chrome, relaunch with the debug port (same profile → Lace stays):
 *         Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *         macOS:   open -na "Google Chrome" --args --remote-debugging-port=9222
 *       2. open the Midnight Sealed-Bid Auction dApp, unlock Lace → Preprod
 *       3. npm run record:wallet   — then click when told. It stops itself.
 * OUT:  docs/wallet-flow-shot.mp4
 *
 * Pixels only: it never reads the bid input (masked) and never touches keys.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import http from 'node:http';

const CDP_PORT = 9222;
const OUT = path.resolve('docs/wallet-flow-shot.mp4');
const FRAME_DIR = path.resolve('.wallet-shot');
const W = 1600;
const H = 1000;
const MAX_SECONDS = 300;

const require_ = createRequire(import.meta.url);
function ffmpegBin() {
  try { return require_('ffmpeg-static'); } catch { return 'ffmpeg'; }
}

const RELAUNCH = `
Could not reach Chrome on http://127.0.0.1:${CDP_PORT}.
  1. Quit Chrome COMPLETELY, then relaunch with the debug port (same profile keeps Lace):
       Windows: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${CDP_PORT}
       macOS:   open -na "Google Chrome" --args --remote-debugging-port=${CDP_PORT}
  2. Open the auction dApp tab in that window. 3. Run this command again.`;

const say = (m) => console.log(`\n\x1b[1;36m▶ ${m}\x1b[0m\n`);

function findPageTab() {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: CDP_PORT, path: '/json' }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try {
          const pages = JSON.parse(b).filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
          if (!pages.length) return reject(new Error('No open tabs.' + RELAUNCH));
          resolve(pages.find((t) => /midnight|localhost|127\.0\.0\.1|vercel\.app/.test(t.url)) ?? pages[0]);
        } catch { reject(new Error('Unexpected /json response.' + RELAUNCH)); }
      });
    }).on('error', () => reject(new Error(RELAUNCH)));
  });
}

async function main() {
  await mkdir(FRAME_DIR, { recursive: true });
  await mkdir(path.dirname(OUT), { recursive: true });
  const tab = await findPageTab();
  console.log(`● recording: ${tab.url}`);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WebSocket failed.' + RELAUNCH)); });

  const frames = [];
  let ackId = 10;
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Page.screencastFrame') {
      const file = path.join(FRAME_DIR, `f${String(frames.length + 1).padStart(5, '0')}.jpg`);
      await writeFile(file, Buffer.from(msg.params.data, 'base64'));
      frames.push({ file, ts: Date.now() / 1000 });
      ws.send(JSON.stringify({ id: ++ackId, method: 'Page.screencastFrameAck', params: { sessionId: msg.params.sessionId } }));
    }
  };
  ws.send(JSON.stringify({ id: 1, method: 'Page.startScreencast', params: { format: 'jpeg', quality: 80, maxWidth: W, maxHeight: H, everyNthFrame: 1 } }));

  let evalId = 100;
  const evaluate = (expr) => new Promise((resolve) => {
    const id = ++evalId;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { ws.removeEventListener('message', onMsg); resolve(m.result?.result?.value); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  });

  const started = Date.now();
  const stages = [
    { until: `!!document.querySelector('.address-code')`,
      prompt: 'STEP 1/3 — click "Connect" / "Connect Lace Wallet", then approve inside the Lace extension. I detect the moment your address appears.' },
    { until: `[...document.querySelectorAll('[class*=spinner],[class*=generating],[class*=proving]')].some(e=>e.offsetParent!==null) || !!document.querySelector('[class*="result"]')`,
      prompt: 'STEP 2/3 — type your sealed bid (stays masked) and submit it. I watch for the proof-generation state.' },
    { until: `!!document.querySelector('[class*="result"]')`,
      prompt: 'STEP 3/3 — nothing to click: proving and submitting. Recording stops when the result card renders.' },
  ];

  let stopped = false;
  for (const s of stages) {
    say(s.prompt);
    while (!stopped) {
      if ((Date.now() - started) / 1000 > MAX_SECONDS) { stopped = true; say(`${MAX_SECONDS}s limit — assembling what was captured.`); break; }
      if ((await evaluate(s.until)) === true) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (stopped) break;
    await new Promise((r) => setTimeout(r, 2500));
  }

  ws.close();
  if (frames.length < 10) { console.error(`only ${frames.length} frames — nothing to assemble.`); process.exit(1); }

  const list = ['ffconcat version 1.0'];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1];
    const dur = next ? Math.min(0.5, Math.max(1 / 30, next.ts - frames[i].ts)) : 0.5;
    list.push(`file '${path.relative(path.dirname(OUT), frames[i].file)}'`);
    list.push(`duration ${dur.toFixed(3)}`);
  }
  list.push(`file '${path.relative(path.dirname(OUT), frames[frames.length - 1].file)}'`);
  const listPath = path.join(FRAME_DIR, 'list.ffconcat');
  await writeFile(listPath, list.join('\n') + '\n');

  console.log(`assembling ${frames.length} frames → ${OUT}`);
  const code = await new Promise((resolve) => {
    spawn(ffmpegBin(), ['-y', '-f', 'concat', '-safe', '0', '-i', listPath,
      '-vf', `scale=${W}:${H},format=yuv420p`, '-r', '30', '-c:v', 'libx264', '-crf', '23',
      '-movflags', '+faststart', OUT], { stdio: ['ignore', 'ignore', 'inherit'] }).on('exit', resolve);
  });
  if (code !== 0) { console.error(`ffmpeg exited ${code}`); process.exit(1); }
  console.log(`done: ${OUT}`);
  console.log('This is the wallet shot. Pair it with docs/level3-reel.mp4 for the full 1-minute video.');
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
