import { getSupabase } from '../shared/supabase.js';
async function main() {
  const sb = getSupabase();
  const { data } = await sb.from('entities').select('*').limit(1);
  if (data && data[0]) {
    const keys = Object.keys(data[0]).sort();
    console.log(`\nEntity columns (${keys.length}):`);
    keys.forEach(k => {
      const val = data[0][k];
      const type = val === null ? 'null' : typeof val;
      const preview = val !== null && val !== undefined ? String(val).substring(0, 60) : '(null)';
      console.log(`  ${k}: ${type} = ${preview}`);
    });
  }
}
main().catch(console.error);
