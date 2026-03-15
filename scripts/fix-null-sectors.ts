import { getSupabase } from '../shared/supabase.js';

async function fix() {
  const sb = getSupabase();
  
  // Rule 1: EBA parsers = Payments (they are EMI/PI/Payment Institutions)
  const { count: eba } = await sb.from('entities')
    .update({ sector: 'Payments' })
    .is('sector', null)
    .like('parser_id', 'eba-%')
    .select('id', { count: 'exact', head: true });
  console.log('EBA → Payments:', eba);
  
  // Rule 2: ESMA parsers = Crypto (they are CASP/MiCA registrations)
  const { count: esma } = await sb.from('entities')
    .update({ sector: 'Crypto' })
    .is('sector', null)
    .like('parser_id', 'esma-%')
    .select('id', { count: 'exact', head: true });
  console.log('ESMA → Crypto:', esma);
  
  // Rule 3: Entities with confirmed_crypto → Crypto
  const { count: crypto } = await sb.from('entities')
    .update({ sector: 'Crypto' })
    .is('sector', null)
    .eq('crypto_status', 'confirmed_crypto')
    .select('id', { count: 'exact', head: true });
  console.log('confirmed_crypto → Crypto:', crypto);
  
  // Rule 4: Known crypto parsers → Crypto
  const cryptoParsers = ['li-fma', 'ee-fiu', 'hr-hanfa', 'ke-cma', 'cl-cmf', 'ua-nssmc', 'vn-sbv', 'ng-cbn', 'ru-cbr', 'ge-nbg', 'pk-secp', 'pe-sbs', 'tz-bot', 'bd-bsec', 'bh-cbb', 'bm-bma', 'in-fiu', 'kz-afsa', 'tr-spk', 'ae-adgm', 'ae-dfsa', 'il-isa', 'je-jfsc', 'gg-gfsc', 'vg-fsc', 'sa-sama', 'qa-qfcra', 'pa-sbp', 'mx-cnbv', 'co-sfc'];
  const { count: knownCrypto } = await sb.from('entities')
    .update({ sector: 'Crypto' })
    .is('sector', null)
    .in('parser_id', cryptoParsers)
    .select('id', { count: 'exact', head: true });
  console.log('Known crypto parsers → Crypto:', knownCrypto);
  
  // Rule 5: PL KNF = traditional payment institutions → Payments
  const { count: plKnf } = await sb.from('entities')
    .update({ sector: 'Payments' })
    .is('sector', null)
    .eq('parser_id', 'pl-knf')
    .select('id', { count: 'exact', head: true });
  console.log('PL-KNF → Payments:', plKnf);
  
  // Final check
  const { count: remaining } = await sb.from('entities')
    .select('id', { count: 'exact', head: true })
    .is('sector', null)
    .neq('is_garbage', true);
  console.log('\nRemaining null sector:', remaining);
}
fix();
