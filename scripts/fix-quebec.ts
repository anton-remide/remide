/**
 * Flag Quebec numbered companies as garbage
 * Pattern: XXXX-XXXX Québec/Quebec
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  // Find Quebec numbered companies
  const { data, error } = await sb
    .from('entities')
    .select('id, name, canonical_name')
    .eq('is_garbage', false)
    .eq('country_code', 'CA');

  if (error) { console.error('Error:', error.message); return; }

  const quebec = data!.filter(e => {
    const n = e.canonical_name || e.name;
    return /^\d{4}-\d{4}\s+(Qu[eé]bec|Quebec)/i.test(n);
  });

  console.log(`Found ${quebec.length} Quebec numbered companies to flag`);
  quebec.forEach(e => console.log(`  "${e.canonical_name || e.name}"`));

  if (quebec.length === 0) return;

  const ids = quebec.map(e => e.id);
  const { data: updated, error: err2 } = await sb
    .from('entities')
    .update({ is_garbage: true, quality_flags: ['numbered_company:quebec'] })
    .in('id', ids)
    .select('id');

  console.log(`\nFlagged: ${updated?.length ?? 0} entities`);
  if (err2) console.error('Error:', err2.message);
}

main();
