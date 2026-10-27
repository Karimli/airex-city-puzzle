#!/usr/bin/env node
/**
 * sw.js-dəki PRECACHE siyahısını və VERSION-u yeniləyir.
 * Hər dəyişiklikdən sonra, push-dan əvvəl işlədin:  node tools/update-sw.mjs
 *
 * Siyahıya: index.html, result/, css/, js/, vendor/, assets/ (lisenziya .txt faylları xaric).
 * VERSION = bütün faylların məzmununun hash-i → fayl dəyişməyibsə versiya da dəyişmir.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['css', 'js', 'vendor', 'assets'];
const PAGES = { 'index.html': './', 'result/index.html': './result/' };
const SKIP = (name) => name.startsWith('.') || name.endsWith('.txt');

/** @param {string} dir */
async function walk(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP(entry.name)) continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(rel)));
    else files.push(rel);
  }
  return files;
}

const files = [...Object.keys(PAGES), ...(await Promise.all(DIRS.map(walk))).flat()].sort();

const hash = createHash('sha256');
for (const file of files) {
  hash.update(file);
  hash.update(await readFile(path.join(ROOT, file)));
}
const version = hash.digest('hex').slice(0, 12);
const urls = files.map((file) => PAGES[file] ?? `./${file}`);

const block = [
  '// <precache> — tools/update-sw.mjs tərəfindən yaradılır, əl ilə dəyişməyin',
  `const VERSION = '${version}';`,
  'const PRECACHE = [',
  ...urls.map((url) => `  '${url}',`),
  '];',
  '// </precache>',
].join('\n');

const swPath = path.join(ROOT, 'sw.js');
const sw = await readFile(swPath, 'utf8');
const next = sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
if (next === sw) {
  console.log(`sw.js dəyişməyib (versiya ${version}, ${urls.length} fayl)`);
} else {
  await writeFile(swPath, next);
  console.log(`sw.js yeniləndi: versiya ${version}, ${urls.length} fayl`);
}
