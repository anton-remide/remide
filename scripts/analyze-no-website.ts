import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();

  // 1) Country distribution
  const { data: byCountry } = await sb
    .from('entities')
    .select('country_code')
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true);

  const countryMap: Record<string, number> = {};
  (byCountry || []).forEach((r: any) => {
    countryMap[r.country_code || '??'] = (countryMap[r.country_code || '??'] || 0) + 1;
  });

  const sortedCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1]);
  console.log('\n=== No-website entities by COUNTRY (top 20) ===');
  sortedCountry.slice(0, 20).forEach(([cc, count]) => console.log(`  ${cc}: ${count}`));
  console.log(`  Total: ${sortedCountry.reduce((s, [, c]) => s + c, 0)}`);

  // 2) Regulator distribution
  const { data: byReg } = await sb
    .from('entities')
    .select('regulator')
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true);

  const regMap: Record<string, number> = {};
  (byReg || []).forEach((r: any) => {
    regMap[r.regulator || '??'] = (regMap[r.regulator || '??'] || 0) + 1;
  });

  const sortedReg = Object.entries(regMap).sort((a, b) => b[1] - a[1]);
  console.log('\n=== No-website entities by REGULATOR (top 15) ===');
  sortedReg.slice(0, 15).forEach(([reg, count]) => console.log(`  ${reg}: ${count}`));

  // 3) Samples — top quality
  const { data: samplesTop } = await sb
    .from('entities')
    .select('id, name, canonical_name, country_code, regulator, quality_score, raw_data')
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    .order('quality_score', { ascending: false })
    .limit(20);

  console.log('\n=== Top 20 no-website entities (highest quality_score) ===');
  (samplesTop || []).forEach((r: any) => {
    const src = r.raw_data?.source_url
      ? String(r.raw_data.source_url).substring(0, 80)
      : 'no-source';
    console.log(`  [${r.quality_score ?? '-'}] ${r.country_code} | ${r.canonical_name || r.name} | ${r.regulator || '-'} | ${src}`);
  });

  // 4) Samples — random
  const { data: samplesRand } = await sb
    .from('entities')
    .select('id, name, canonical_name, country_code, regulator, quality_score')
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    .limit(20);

  console.log('\n=== 20 random no-website entities ===');
  (samplesRand || []).forEach((r: any) => {
    console.log(`  [${r.quality_score ?? '-'}] ${r.country_code} | ${r.canonical_name || r.name} | ${r.regulator || '-'}`);
  });

  // 5) Check raw_data for any website hints
  const { data: withRawData } = await sb
    .from('entities')
    .select('id, name, canonical_name, raw_data')
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true)
    .not('raw_data', 'is', null)
    .limit(1000);

  let hasWebsiteHint = 0;
  const hints: string[] = [];
  (withRawData || []).forEach((r: any) => {
    const rd = r.raw_data || {};
    const possibleKeys = ['website', 'url', 'homepage', 'web', 'site', 'domain', 'company_url', 'company_website'];
    for (const k of possibleKeys) {
      if (rd[k] && typeof rd[k] === 'string' && rd[k].length > 5) {
        hasWebsiteHint++;
        if (hints.length < 10) hints.push(`${r.canonical_name || r.name}: raw_data.${k} = ${rd[k]}`);
        break;
      }
    }
  });

  console.log(`\n=== Website hints in raw_data (from 1000 sample) ===`);
  console.log(`  Found hints: ${hasWebsiteHint}`);
  hints.forEach(h => console.log(`  ${h}`));
}

main().catch(console.error);
