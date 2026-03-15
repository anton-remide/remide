import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  // Page 1: first 100 entities by name
  for (let page = 0; page < 3; page++) {
    const { data, error } = await sb
      .from('entities')
      .select('id, name, canonical_name, country_code, country, regulator, status, sector, license_type, dns_status, is_garbage, quality_score, crypto_status')
      .order('name')
      .range(page * 100, page * 100 + 99);
    
    if (error) { console.error(error); return; }
    
    console.log(`\n=== PAGE ${page + 1} (entities ${page*100+1}-${(page+1)*100}) ===\n`);
    
    for (const e of data) {
      const name = e.canonical_name || e.name;
      const flags = [];
      if (e.is_garbage) flags.push('🗑️GARBAGE');
      if (e.dns_status === 'dead') flags.push('💀DEAD');
      if (e.quality_score !== null && e.quality_score >= 80) flags.push('⭐HIGH_Q');
      if (e.quality_score !== null && e.quality_score < 30) flags.push('🔻LOW_Q');
      
      // Flag suspicious names
      if (/^\d/.test(name)) flags.push('⚠️STARTS_WITH_NUM');
      if (name.length < 3) flags.push('⚠️TOO_SHORT');
      if (name.length > 80) flags.push('⚠️TOO_LONG');
      if (/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(name)) flags.push('⚠️WEIRD_CHARS');
      
      const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
      console.log(`  ${e.country_code} | ${name} | ${e.sector || '?'} | ${e.status} | ${e.regulator}${flagStr}`);
    }
  }
  
  // Also get some stats
  console.log('\n=== QUALITY STATS ===');
  const { count: total } = await sb.from('entities').select('id', { count: 'exact', head: true });
  const { count: garbage } = await sb.from('entities').select('id', { count: 'exact', head: true }).eq('is_garbage', true);
  const { count: dead } = await sb.from('entities').select('id', { count: 'exact', head: true }).eq('dns_status', 'dead');
  const { count: numStart } = await sb.from('entities').select('id', { count: 'exact', head: true }).like('canonical_name', '0%');
  
  // Get sector breakdown
  for (const sector of ['Crypto', 'Payments', 'Banking']) {
    const { count } = await sb.from('entities').select('id', { count: 'exact', head: true }).eq('sector', sector);
    console.log(`  ${sector}: ${count}`);
  }
  const { count: nullSector } = await sb.from('entities').select('id', { count: 'exact', head: true }).is('sector', null);
  console.log(`  null sector: ${nullSector}`);
  console.log(`  Total: ${total} | Garbage: ${garbage} | Dead DNS: ${dead}`);
}

main().catch(console.error);
