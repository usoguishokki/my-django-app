import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


async function findTests(directory) {
  const tests = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      tests.push(...await findTests(absolute));
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      tests.push(absolute);
    }
  }
  return tests;
}


const tests = (await findTests(path.resolve('myapp/static/js'))).sort();
if (tests.length === 0) {
  console.error('No JavaScript tests were found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
