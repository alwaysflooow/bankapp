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

const css = read('assets/styles.css');
const js = ['assets/icons.js', 'assets/data.js', 'assets/app.js'].map(read).join('\n');

const out =
  '<title>Discovery Bank</title>\n' +
  '<style>\n' + css + '\n</style>\n' +
  body.replace(/\s*<script src="[^"]+"><\/script>/g, '').trim() + '\n' +
  '<script>\n' + js + '\n</script>\n';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/discovery-bank.html'), out);

console.log('dist/discovery-bank.html — ' + (out.length / 1024).toFixed(1) + ' KB');
