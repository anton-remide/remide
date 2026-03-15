import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function apply() {
  // Use pg-meta API to execute raw SQL
  const projectRef = new URL(url).hostname.split('.')[0]; // e.g. cydzgjrvcclkigcizddc
  console.log('Project ref:', projectRef);

  // Approach: use supabase-js to test if column already exists
  const sb = createClient(url, key);

  // Test if is_hidden already exists
  const { data, error } = await sb.from('entities').select('id, is_hidden').limit(1);
  if (!error) {
    console.log('✅ is_hidden column already exists');
    return;
  }

  if (error.message.includes('is_hidden')) {
    console.log('Column does not exist yet. Please run this SQL in Supabase Dashboard:');
    console.log('');
    console.log('ALTER TABLE entities ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;');
    console.log('ALTER TABLE entities ADD COLUMN IF NOT EXISTS hidden_reason TEXT;');
    console.log('CREATE INDEX IF NOT EXISTS idx_entities_hidden ON entities(is_hidden) WHERE is_hidden = true;');
    console.log('');
    console.log('URL: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  } else {
    console.log('Unexpected error:', error.message);
  }
}

apply().catch(console.error);
