import { getSupabase } from '../shared/supabase.js';

async function main() {
  const sb = getSupabase();
  const q = (filter: (q: any) => any) => filter(sb.from('entities').select('id', { count: 'exact', head: true })).then((r: any) => r.count);

  const total = await q(q => q);
  const withWeb = await q(q => q.neq('website', ''));
  const enriched = await q(q => q.not('enriched_at', 'is', null));
  const withDesc = await q(q => q.not('description', 'is', null));
  const notGarbage = await q(q => q.neq('is_garbage', true).neq('is_hidden', true));
  const webNotEnriched = await q(q => q.neq('website', '').is('enriched_at', null).neq('is_garbage', true).neq('is_hidden', true));
  const noWebNotGarbage = await q(q => q.eq('website', '').neq('is_garbage', true).neq('is_hidden', true));

  console.log(`Total entities:          ${total}`);
  console.log(`Not garbage/hidden:      ${notGarbage}`);
  console.log(`With website:            ${withWeb}`);
  console.log(`Enriched (enriched_at):  ${enriched}`);
  console.log(`With description:        ${withDesc}`);
  console.log(`Website but NOT enriched: ${webNotEnriched}  ← TARGET`);
  console.log(`No website, not garbage:  ${noWebNotGarbage}`);
}
main();
