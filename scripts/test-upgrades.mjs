import { spawnSync } from 'node:child_process'
import { localDatabaseUrl } from './check-schema.mjs'
const result = spawnSync(process.execPath,['--test','--test-concurrency=1','tests/db/upgrade.test.mjs'],{
  stdio:'inherit',env:{...process.env,DATABASE_URL:localDatabaseUrl()},
})
process.exit(result.status??1)
