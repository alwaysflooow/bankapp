/* Готовит иконку приложения icons/app-icon.png — её видят iOS и Android,
   когда макет вынесен на домашний экран.

   Источник берётся так:
     1. brand/logo.png    — если файл есть, иконка собирается из него:
                            логотип вписывается в квадрат 512×512, по краям
                            остаётся поле 14%, фон заливается белым;
     2. иначе             — рисуется фирменный знак из assets/icons.js.

   Запуск: node tools/make-icons.mjs   (нужны node и playwright)

   Скрипт нужен только для удобства. Если node под рукой нет, просто
   положите свой квадратный PNG 512×512 на место icons/app-icon.png —
   приложение подхватит его без всякой сборки.
*/
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const SIZE = 512;
const BG = '#ffffff';
const logoPath = path.join(root, 'brand', 'logo.png');
const hasLogo = fs.existsSync(logoPath);

const MARK = `<path d="M4.6 6.8 12 14.1l7.4-7.3"/><path d="M4.6 12.4 12 19.7l7.4-7.3"/>`;

let inner;
if (hasLogo) {
  const b64 = fs.readFileSync(logoPath).toString('base64');
  // 72% стороны: поле по краям спасает логотип от круглой обрезки на Android
  inner = `<img src="data:image/png;base64,${b64}" alt="">`;
} else {
  inner = `<svg viewBox="0 0 24 24">${MARK}</svg>`;
}

const page = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  .i{width:${SIZE}px;height:${SIZE}px;background:${BG};display:grid;place-items:center;overflow:hidden}
  .i img{width:${Math.round(SIZE * 0.72)}px;height:${Math.round(SIZE * 0.72)}px;object-fit:contain}
  .i svg{width:${Math.round(SIZE * 0.6)}px;height:${Math.round(SIZE * 0.6)}px;
      fill:none;stroke:#D3168C;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
</style>
<div class="i">${inner}</div>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
});
const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await p.setContent(page);
await p.locator('.i').screenshot({ path: path.join(outDir, 'app-icon.png') });
await browser.close();

console.log('icons/app-icon.png — источник: ' + (hasLogo ? 'brand/logo.png' : 'знак из assets/icons.js'));
