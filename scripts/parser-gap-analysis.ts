import { getSupabase } from '../shared/supabase.js';
import { PARSERS } from '../parsers/registry.js';

async function fetchAll(sb: any) {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await sb
      .from('entities')
      .select('country_code, regulator')
      .neq('is_garbage', true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < 1000) break;
  }
  return all;
}

async function main() {
  const sb = getSupabase();

  // Map parser IDs to country codes
  const parserCountries = new Set<string>();
  const parserIds = Object.keys(PARSERS);
  parserIds.forEach(id => {
    const cc = id.split('-')[0].toUpperCase();
    parserCountries.add(cc);
  });

  console.log(`\nTotal parsers registered: ${parserIds.length}`);
  console.log(`Countries with parsers: ${[...parserCountries].sort().join(', ')}`);

  // Get all entities grouped by country + regulator
  const all = await fetchAll(sb);
  console.log(`\nTotal entities in DB (not garbage): ${all.length}`);

  // By country
  const byCountry: Record<string, number> = {};
  all.forEach(r => { byCountry[r.country_code || '??'] = (byCountry[r.country_code || '??'] || 0) + 1; });

  // By regulator
  const byReg: Record<string, { count: number; country: string }> = {};
  all.forEach(r => {
    const reg = r.regulator || '??';
    if (!byReg[reg]) byReg[reg] = { count: 0, country: r.country_code };
    byReg[reg].count++;
  });

  // Countries WITHOUT parsers but WITH entities
  console.log('\n=== Countries WITH entities but NO parser ===');
  const missingCountries = Object.entries(byCountry)
    .filter(([cc]) => !parserCountries.has(cc) && cc !== '??' && cc !== 'ESMA' && cc !== 'EBA')
    .sort((a, b) => b[1] - a[1]);

  if (missingCountries.length === 0) {
    console.log('  None! All countries with entities have parsers.');
  } else {
    missingCountries.forEach(([cc, count]) => {
      const regs = Object.entries(byReg)
        .filter(([, v]) => v.country === cc)
        .map(([r, v]) => `${r}(${v.count})`)
        .join(', ');
      console.log(`  ${cc}: ${count} entities | Regulators: ${regs}`);
    });
  }

  // Regulators by entity count (to find high-value targets)
  console.log('\n=== Top 30 regulators by entity count ===');
  const sortedRegs = Object.entries(byReg).sort((a, b) => b[1].count - a[1].count);
  sortedRegs.slice(0, 30).forEach(([reg, { count, country }]) => {
    const hasParser = parserCountries.has(country);
    console.log(`  ${hasParser ? '✓' : '✗'} ${reg}: ${count} (${country})`);
  });

  // Significant markets we COULD add
  const importantMissing = [
    { country: 'HN', name: 'Honduras' },
    { country: 'DO', name: 'Dominican Republic' },
    { country: 'UY', name: 'Uruguay' },
    { country: 'EC', name: 'Ecuador' },
    { country: 'BO', name: 'Bolivia' },
    { country: 'PY', name: 'Paraguay' },
    { country: 'TT', name: 'Trinidad & Tobago' },
    { country: 'JM', name: 'Jamaica' },
    { country: 'CR', name: 'Costa Rica' },
    { country: 'GT', name: 'Guatemala' },
    { country: 'KW', name: 'Kuwait' },
    { country: 'OM', name: 'Oman' },
    { country: 'JO', name: 'Jordan' },
    { country: 'TN', name: 'Tunisia' },
    { country: 'GH', name: 'Ghana' },
    { country: 'CI', name: "Côte d'Ivoire" },
    { country: 'SN', name: 'Senegal' },
    { country: 'CM', name: 'Cameroon' },
    { country: 'UZ', name: 'Uzbekistan' },
    { country: 'AM', name: 'Armenia' },
    { country: 'AZ', name: 'Azerbaijan' },
    { country: 'LK', name: 'Sri Lanka' },
    { country: 'MM', name: 'Myanmar' },
    { country: 'NP', name: 'Nepal' },
    { country: 'KH', name: 'Cambodia' },
    { country: 'LA', name: 'Laos' },
  ];

  console.log('\n=== Potentially important markets WITHOUT any data ===');
  const noData = importantMissing.filter(m => !byCountry[m.country]);
  noData.forEach(m => console.log(`  ${m.country}: ${m.name}`));

  // Parser health — which parsers actually produced entities?
  const parserToCountry: Record<string, string> = {};
  parserIds.forEach(id => {
    parserToCountry[id] = id.split('-')[0].toUpperCase();
  });

  console.log('\n=== Parsers with 0 entities in DB (possibly broken) ===');
  const emptyParsers = parserIds.filter(id => {
    const cc = parserToCountry[id];
    return !byCountry[cc] || byCountry[cc] === 0;
  });
  if (emptyParsers.length === 0) {
    console.log('  None — all parsers have data.');
  } else {
    emptyParsers.forEach(id => console.log(`  ${id}`));
  }

  // Summary of existing parser website extraction quality
  const { data: websiteStats } = await sb.rpc('', {}).catch(() => ({ data: null }));

  // Manual website coverage per country
  console.log('\n=== Website coverage by top countries ===');
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [cc, total] of topCountries) {
    const { count: withWeb } = await sb
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', cc)
      .neq('website', '')
      .neq('is_garbage', true);
    console.log(`  ${cc}: ${withWeb || 0}/${total} with website (${total > 0 ? ((withWeb || 0) / total * 100).toFixed(0) : 0}%)`);
  }
}

main().catch(console.error);
