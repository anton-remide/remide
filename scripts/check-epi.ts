import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
  // Count all PL entities from eba parser
  const { count: totalPL } = await sb.from('entities').select('*', { count: 'exact', head: true })
    .eq('country_code', 'PL').eq('parser_id', 'eba-pl');

  // Count by license_type
  const { data: all } = await sb.from('entities').select('license_type')
    .eq('country_code', 'PL').eq('parser_id', 'eba-pl');

  const byType: Record<string, number> = {};
  (all || []).forEach(e => {
    const t = e.license_type || 'NULL';
    byType[t] = (byType[t] || 0) + 1;
  });

  console.log('=== PL entities from eba-pl ===');
  console.log('Total:', totalPL);
  console.log('By license_type:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log('  ', k, ':', v);
  });

  // Also check: are there OTHER PL parsers?
  const { data: otherPL } = await sb.from('entities').select('parser_id')
    .eq('country_code', 'PL').neq('parser_id', 'eba-pl');

  const otherParsers: Record<string, number> = {};
  (otherPL || []).forEach(e => {
    otherParsers[e.parser_id || 'NULL'] = (otherParsers[e.parser_id || 'NULL'] || 0) + 1;
  });
  console.log('\nOther PL parsers:', otherParsers);

  // Check total EPI across ALL countries
  const { count: totalEPI } = await sb.from('entities').select('*', { count: 'exact', head: true })
    .eq('license_type', 'E-Money Payment Institution (EPI)');
  console.log('\n=== EPI across ALL countries ===');
  console.log('Total EPI globally:', totalEPI);

  // EPI by country
  const { data: epiAll } = await sb.from('entities').select('country_code')
    .eq('license_type', 'E-Money Payment Institution (EPI)');
  const epiByCountry: Record<string, number> = {};
  (epiAll || []).forEach(e => {
    epiByCountry[e.country_code] = (epiByCountry[e.country_code] || 0) + 1;
  });
  console.log('EPI by country:');
  Object.entries(epiByCountry).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log('  ', k, ':', v);
  });

  // Also check ENL and Exempt EMI across all countries
  for (const lt of ['Entity National Law', 'Exempt EMI']) {
    const { count } = await sb.from('entities').select('*', { count: 'exact', head: true })
      .eq('license_type', lt);
    console.log(`\nTotal "${lt}" globally:`, count);

    const { data } = await sb.from('entities').select('country_code').eq('license_type', lt);
    const byC: Record<string, number> = {};
    (data || []).forEach(e => { byC[e.country_code] = (byC[e.country_code] || 0) + 1; });
    Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => {
      console.log('  ', k, ':', v);
    });
  }
}

check().catch(console.error);
