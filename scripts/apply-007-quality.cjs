/**
 * Apply DDL 007: Quality Pipeline columns + indexes + initial classification.
 * Uses Supabase Management API. Executes each statement individually.
 */
const https = require('https');

const PROJECT_ID = 'cydzgjrvcclkigcizddc';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN not set');
  process.exit(1);
}

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_ID}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function exec(label, sql) {
  process.stdout.write(`  ${label}...`);
  const r = await runSQL(sql);
  if (r.status >= 200 && r.status < 300) {
    console.log(' ✅');
    return true;
  } else if (r.data.includes('already exists')) {
    console.log(' ✅ (already exists)');
    return true;
  } else {
    console.log(` ❌ (${r.status}) ${r.data.substring(0, 150)}`);
    return false;
  }
}

async function main() {
  console.log('🔧 DDL 007: Quality Pipeline\n');
  let ok = 0, fail = 0;

  const steps = [
    // 1. Add columns
    ['ADD canonical_name', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS canonical_name TEXT`],
    ['ADD is_garbage', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS is_garbage BOOLEAN DEFAULT false`],
    ['ADD quality_score', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS quality_score SMALLINT DEFAULT 0`],
    ['ADD quality_flags', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS quality_flags JSONB DEFAULT '{}'`],
    ['ADD last_quality_at', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_quality_at TIMESTAMPTZ`],
    ['ADD crypto_status', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS crypto_status TEXT DEFAULT 'unknown'`],
    ['ADD dns_status', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS dns_status TEXT DEFAULT 'unknown'`],
    ['ADD dns_checked_at', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS dns_checked_at TIMESTAMPTZ`],
    ['ADD last_verified_at', `ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ`],

    // 2. Indexes
    ['IDX quality_score', `CREATE INDEX IF NOT EXISTS idx_entities_quality_score ON entities(quality_score DESC)`],
    ['IDX crypto_status', `CREATE INDEX IF NOT EXISTS idx_entities_crypto_status ON entities(crypto_status)`],
    ['IDX is_garbage', `CREATE INDEX IF NOT EXISTS idx_entities_garbage ON entities(is_garbage) WHERE is_garbage = true`],
    ['IDX dns_status', `CREATE INDEX IF NOT EXISTS idx_entities_dns_status ON entities(dns_status)`],

    // 3. Classify crypto_status by parser source
    ['SET confirmed_crypto (VASP registries)', `
      UPDATE entities SET crypto_status = 'confirmed_crypto'
      WHERE parser_id IN (
        'esma-de', 'esma-nl', 'esma-fr', 'esma-es', 'esma-it', 'esma-at',
        'esma-cz', 'esma-fi', 'esma-ie', 'esma-lt', 'esma-lu', 'esma-lv',
        'esma-mt', 'esma-pl', 'esma-sk', 'esma-si', 'esma-cy', 'esma-bg',
        'esma-se', 'esma-be', 'esma-hr', 'esma-pt', 'esma-ro', 'esma-hu',
        'esma-gr', 'esma-ee', 'esma-dk', 'esma-li', 'esma-no', 'esma-is',
        'ae-vara', 'ae-adgm', 'ae-dfsareg',
        'th-sec', 'my-sc', 'sc-fsa', 'gi-gfsc', 'im-fsa',
        'li-fma', 'tw-fsc', 'ky-cima', 'id-ojk',
        'hk-sfc', 'kr-fiu', 'ar-cnv', 'ph-bsp', 'sv-cnad',
        'us-nydfs', 'ng-sec', 'esma-unified'
      )
    `],
    ['SET traditional (banking)', `UPDATE entities SET crypto_status = 'traditional' WHERE parser_id IN ('us-fdic', 'gb-pra')`],
    ['SET traditional (EBA payments)', `UPDATE entities SET crypto_status = 'traditional' WHERE parser_id LIKE 'eba-%'`],

    // 4. Sync crypto_related with crypto_status
    ['SYNC crypto_related=true', `UPDATE entities SET crypto_related = true WHERE crypto_status IN ('confirmed_crypto', 'crypto_adjacent')`],
    ['SYNC crypto_related=false', `UPDATE entities SET crypto_related = false WHERE crypto_status IN ('traditional', 'unknown')`],
  ];

  for (const [label, sql] of steps) {
    const result = await exec(label, sql);
    result ? ok++ : fail++;
  }

  console.log(`\n📊 ${ok} ok, ${fail} failed / ${steps.length} total`);

  // Verify
  console.log('\n📝 Verify: new columns...');
  const cols = await runSQL(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'entities'
    AND column_name IN ('canonical_name','is_garbage','quality_score','quality_flags',
      'last_quality_at','crypto_status','dns_status','dns_checked_at','last_verified_at')
    ORDER BY column_name
  `);
  console.log(cols.data);

  console.log('📝 Verify: crypto_status distribution...');
  const dist = await runSQL(`
    SELECT crypto_status, count(*) as cnt FROM entities GROUP BY crypto_status ORDER BY cnt DESC
  `);
  console.log(dist.data);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
