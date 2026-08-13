/* Готовит иконку приложения icons/app-icon.png — её видят iOS и Android,
   когда макет вынесен на домашний экран.

   Источник берётся так:
     1. brand/logo.png    — если файл есть, иконка собирается из него:
                            логотип вписывается в квадрат 512×512, по краям
                            остаётся поле 14%, фон заливается белым;
     2. иначе             — рисуется фирменная иконка: тёмно-синий квадрат,
                            белый круг с градиентным кольцом и знак внутри.

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
const logoPath = path.join(root, 'brand', 'logo.png');
const hasLogo = fs.existsSync(logoPath);

/* ромб и два шеврона — та же геометрия, что в assets/icons.js */
const MARK_FULL = `
  <path d="M12 3.5 14.1 5.6 12 7.7 9.9 5.6Z"/>
  <path d="M6.5 8.1 12 13.6 17.5 8.1 15.2 5.8 12 9 8.8 5.8Z"/>
  <path d="M3.4 12.6 12 21.2 20.6 12.6 18.3 10.3 12 16.6 5.7 10.3Z"/>`;

let html;

if (hasLogo) {
  const b64 = fs.readFileSync(logoPath).toString('base64');
  html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  .i{width:${SIZE}px;height:${SIZE}px;background:#fff;display:grid;place-items:center;overflow:hidden}
  .i img{width:${Math.round(SIZE * 0.72)}px;height:${Math.round(SIZE * 0.72)}px;object-fit:contain}
</style>
<div class="i"><img src="data:image/png;base64,${b64}" alt=""></div>`;
} else {
  html = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0}
  .i{
    position:relative; width:${SIZE}px; height:${SIZE}px; overflow:hidden;
    background:linear-gradient(165deg,#1d558f 0%, #143f74 46%, #0c2b53 100%);
    display:grid; place-items:center;
  }
  /* кольцо: градиент по кругу, белый диск сверху закрывает середину */
  .ring{
    position:relative; width:${Math.round(SIZE * 0.82)}px; height:${Math.round(SIZE * 0.82)}px;
    border-radius:50%;
    background:conic-gradient(from 210deg,
      #16b6d4 0%, #2f6fe4 22%, #6b2ff5 46%, #d4179a 66%, #e6007e 78%, #16b6d4 100%);
  }
  .ring::after{
    content:""; position:absolute; inset:${Math.round(SIZE * 0.035)}px;
    border-radius:50%; background:#fff;
  }
  .mark{
    position:absolute; inset:0; margin:auto;
    width:${Math.round(SIZE * 0.5)}px; height:${Math.round(SIZE * 0.5)}px; z-index:1;
  }
</style>
<div class="i">
  <div class="ring">
    <svg class="mark" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#2f6fe4"/>
          <stop offset="55%" stop-color="#7b2ff7"/>
          <stop offset="100%" stop-color="#e6007e"/>
        </linearGradient>
      </defs>
      <g fill="url(#g)">${MARK_FULL}</g>
    </svg>
  </div>
</div>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
});
const p = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
await p.setContent(html);
await p.locator('.i').screenshot({ path: path.join(outDir, 'app-icon.png') });
await browser.close();

console.log('icons/app-icon.png — источник: ' + (hasLogo ? 'brand/logo.png' : 'фирменная иконка из скрипта'));
