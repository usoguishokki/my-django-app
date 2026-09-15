import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve('myapp/static/js');
const importPattern = /(?:import|export)(?:[\s\S]*?\sfrom\s*)?["'](?<url>\.{1,2}\/[^"']+)["']\s*;|import\(\s*["'](?<dynamicUrl>\.{1,2}\/[^"']+)["']\s*\)/g;

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'tests') {
      files.push(...await walk(absolute));
    } else if (
      entry.isFile()
      && entry.name.endsWith('.js')
      && entry.name !== 'test.js'
    ) {
      files.push(absolute);
    }
  }
  return files;
}

const files = await walk(root);
const errors = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const syntax = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    { input: source, encoding: 'utf8' },
  );
  if (syntax.status !== 0) {
    errors.push(`${path.relative(root, file)}: ${syntax.stderr.trim()}`);
  }

  for (const match of source.matchAll(importPattern)) {
    const specifier = match.groups.url ?? match.groups.dynamicUrl;
    const target = path.resolve(path.dirname(file), specifier);
    if (!existsSync(target)) {
      errors.push(
        `${path.relative(root, file)}: import target does not exist: ${specifier}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Validated ${files.length} browser JavaScript modules.`);
