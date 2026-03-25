import { getSupabase } from '../shared/supabase.js';

async function fetchAll(sb: any, baseQuery: (q: any) => any, batchSize = 1000) {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const q = baseQuery(sb.from('entities').select('country_code, regulator, name, canonical_name', { count: 'exact' }))
      .range(offset, offset + batchSize - 1);
    const { data, count } = await q;
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += data.length;
    if (data.length < batchSize) break;
  }
  return all;
}

async function main() {
  const sb = getSupabase();

  const filter = (q: any) => q
    .or('website.is.null,website.eq.')
    .neq('is_garbage', true)
    .neq('is_hidden', true);

  const all = await fetchAll(sb, filter);
  console.log(`\nTotal entities without website (not garbage/hidden): ${all.length}`);

  // Country
  const countryMap: Record<string, number> = {};
  all.forEach(r => { countryMap[r.country_code || '??'] = (countryMap[r.country_code || '??'] || 0) + 1; });
  const sortedCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1]);
  console.log('\n=== By COUNTRY ===');
  sortedCountry.forEach(([cc, count]) => console.log(`  ${cc}: ${count} (${(count / all.length * 100).toFixed(1)}%)`));

  // Regulator
  const regMap: Record<string, number> = {};
  all.forEach(r => { regMap[r.regulator || '??'] = (regMap[r.regulator || '??'] || 0) + 1; });
  const sortedReg = Object.entries(regMap).sort((a, b) => b[1] - a[1]);
  console.log('\n=== By REGULATOR ===');
  sortedReg.forEach(([reg, count]) => console.log(`  ${reg}: ${count} (${(count / all.length * 100).toFixed(1)}%)`));

  // Known brands without websites
  const knownBrands = ['coincheck', 'okx', 'credit suisse', 'morgan stanley', 'bitflyer', 'coinbase',
    'binance', 'kraken', 'gemini', 'bitstamp', 'huobi', 'kucoin', 'bybit', 'bitget',
    'dotpay', 'kirobo', 'israel discount bank', 'dv chain'];
  console.log('\n=== Known brands found without website ===');
  all.forEach(r => {
    const name = (r.canonical_name || r.name || '').toLowerCase();
    for (const brand of knownBrands) {
      if (name.includes(brand)) {
        console.log(`  ${r.country_code} | ${r.canonical_name || r.name} | ${r.regulator}`);
        break;
      }
    }
  });
}

main().catch(console.error);
