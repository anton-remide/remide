/**
 * Apply DDL 005: Add slug column to stablecoin_issuers + populate.
 * Uses Supabase Management API (access token) to run raw SQL.
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
      hostname: `${PROJECT_ID}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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

// Use Management API instead
function runSQLViaManagement(sql) {
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

async function main() {
  console.log('🔧 Applying DDL 005: issuer slug column...\n');

  // Step 1: Check if column exists
  const check = await runSQLViaManagement(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'stablecoin_issuers' AND column_name = 'slug'
  `);
  console.log('Check slug column:', check.status, check.data.substring(0, 200));

  if (check.data.includes('"slug"') || check.data.includes("'slug'")) {
    console.log('✅ slug column already exists');
  } else {
    // Step 2: Add slug column
    console.log('\n📝 Adding slug column...');
    const add = await runSQLViaManagement(`
      ALTER TABLE stablecoin_issuers ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
    `);
    console.log('Add column:', add.status, add.data.substring(0, 200));
  }

  // Step 3: Populate slugs
  console.log('\n📝 Populating slugs from names...');
  const populate = await runSQLViaManagement(`
    UPDATE stablecoin_issuers
    SET slug = trim(BOTH '-' FROM lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
    WHERE slug IS NULL
  `);
  console.log('Populate:', populate.status, populate.data.substring(0, 200));

  // Step 4: Fix duplicates
  console.log('\n📝 Fixing duplicate slugs...');
  const dedup = await runSQLViaManagement(`
    WITH dupes AS (
      SELECT slug, array_agg(id ORDER BY id) AS ids
      FROM stablecoin_issuers
      WHERE slug IS NOT NULL
      GROUP BY slug
      HAVING count(*) > 1
    )
    UPDATE stablecoin_issuers si
    SET slug = si.slug || '-' || si.id
    FROM dupes d
    WHERE si.slug = d.slug
    AND si.id != d.ids[1]
  `);
  console.log('Dedup:', dedup.status, dedup.data.substring(0, 200));

  // Step 5: Verify
  console.log('\n📝 Verifying...');
  const verify = await runSQLViaManagement(`
    SELECT count(*) AS total, count(slug) AS with_slug, count(*) - count(slug) AS without_slug
    FROM stablecoin_issuers
  `);
  console.log('Verify:', verify.status, verify.data);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
