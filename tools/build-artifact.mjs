/* Собирает макет в один самодостаточный HTML-файл (dist/discovery-bank.html).
   Нужен для публикации артефакта и для отправки макета одним файлом:
   внешние запросы там запрещены, поэтому CSS и JS инлайнятся.

   Запуск: node tools/build-artifact.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));

// шрифт бланка выписки вшиваем в CSS: одиночный файл должен работать
// и без соседних папок
const fontB64 = fs.readFileSync(path.join(root, 'assets/fonts/open-sans.woff2')).toString('base64');
const css = read('assets/styles.css')
  .replace("url('fonts/open-sans.woff2')", `url(data:font/woff2;base64,${fontB64})`);
const js = ['assets/icons.js', 'assets/data.js', 'assets/app.js'].map(read).join('\n');

// картинки бренда вшиваем в разметку: одиночный файл не может ходить за
// соседними папками
const brand = fs.readdirSync(path.join(root, 'assets/brand'))
  .filter((f) => f.endsWith('.png'));

const out0 =
  '<title>Discovery Bank</title>\n' +
  '<style>\n' + css + '\n</style>\n' +
  body.replace(/\s*<script src="[^"]+"><\/script>/g, '').trim() + '\n' +
  '<script>\n' + js + '\n</script>\n';

const out = brand.reduce((acc, f) => {
  const b64 = fs.readFileSync(path.join(root, 'assets/brand', f)).toString('base64');
  return acc.split('assets/brand/' + f).join('data:image/png;base64,' + b64);
}, out0);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/discovery-bank.html'), out);

console.log('dist/discovery-bank.html — ' + (out.length / 1024).toFixed(1) + ' KB');
