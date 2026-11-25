// Compiles the *.test.ts files and runs them with Node's built-in test runner.
// No extra test framework needed; works the same on Windows, macOS and Linux.
const { spawnSync } = require('node:child_process');
const { readdirSync, rmSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const outDir = join(root, '.test-dist');

const run = (command, args) =>
  spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });

const collectTests = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectTests(path);
    return entry.endsWith('.test.js') ? [path] : [];
  });

rmSync(outDir, { recursive: true, force: true });

const compile = run('npx', ['tsc', '-p', 'tsconfig.test.json']);
if (compile.status !== 0) process.exit(compile.status ?? 1);

const result = run('node', ['--test', '--test-reporter=spec', ...collectTests(outDir)]);
process.exit(result.status ?? 1);
