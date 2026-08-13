/* Рисует иконки для домашнего экрана (icons/*.png) из фирменного знака.
   iOS берёт apple-touch-icon 180×180, Android — 192/512 из манифеста,
   maskable-версия с увеличенными полями нужна под круглые маски Android.

   Запуск: node tools/make-icons.mjs   (нужен playwright и системный chromium)
*/
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const MARK = `<circle cx="12" cy="12" r="8.6"/>
<path d="M12 3.4c2.4 2.4 3.6 5.4 3.6 8.6S14.4 18.2 12 20.6c-2.4-2.4-3.6-5.4-3.6-8.6S9.6 5.8 12 3.4Z"/>
<path d="M3.6 9.6h16.8M3.6 14.4h16.8"/>`;

const page = (size, scale) => `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  .i{width:${size}px;height:${size}px;background:#fff;display:grid;place-items:center}
  svg{width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;
      fill:none;stroke:#D3168C;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
</style>
<div class="i"><svg viewBox="0 0 24 24">${MARK}</svg></div>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

// [файл, размер, доля знака от стороны]
const targets = [
  ['icon-180.png', 180, 0.66],
  ['icon-192.png', 192, 0.66],
  ['icon-512.png', 512, 0.66],
  ['icon-maskable-512.png', 512, 0.50] // запас под круглую обрезку Android
];

for (const [file, size, scale] of targets) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, scale));
  await p.locator('.i').screenshot({ path: path.join(outDir, file) });
  await p.close();
  console.log('icons/' + file);
}

await browser.close();
