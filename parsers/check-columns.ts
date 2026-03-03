import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://cydzgjrvcclkigcizddc.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const sb = createClient(url, key);

async function main() {
  const { data, error } = await sb.from('entities').select('*').limit(1);
  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('Existing columns:', Object.keys(data[0]).join(', '));
  } else {
    console.log('No data in entities table');
  }
}

main().catch(console.error);
