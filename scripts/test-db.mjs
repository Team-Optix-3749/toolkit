import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { DATABASE_URL } from '../tests/db/helpers.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const files = (await readdir(new URL('../tests/db/', import.meta.url)))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => `tests/db/${name}`)
if (files.length === 0) throw new Error('No database tests found')
const result = spawnSync(process.execPath, ['--env-file-if-exists=.env.local', '--test', '--test-concurrency=1', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL },
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
