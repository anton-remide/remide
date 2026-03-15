import { getSupabase } from '../shared/supabase.js';

async function check() {
  const sb = getSupabase();
  
  const { count: total } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true);
  const { count: crypto } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Crypto');
  const { count: payments } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Payments');
  const { count: banking } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).eq('sector', 'Banking');
  const { count: nullSector } = await sb.from('entities').select('id', { count: 'exact', head: true }).neq('is_garbage', true).is('sector', null);
  
  console.log('=== GLOBAL SECTOR BREAKDOWN ===');
  console.log('Total:', total);
  console.log('Crypto:', crypto);
  console.log('Payments:', payments);
  console.log('Banking:', banking);
  console.log('NULL:', nullSector);
  console.log('Sum:', (crypto||0) + (payments||0) + (banking||0) + (nullSector||0));
  
  // EU specific
  const euCodes = ['DE','FR','IT','ES','NL','PT','AT','BE','IE','LU','FI','GR','SK','SI','EE','LV','LT','MT','CY','HR','BG','RO','HU','CZ','SE','DK','NO','IS','LI','PL'];
  const { count: euCrypto } = await sb.from('entities').select('id', { count: 'exact', head: true }).in('country_code', euCodes).neq('is_garbage', true).eq('sector', 'Crypto');
  const { count: euPayments } = await sb.from('entities').select('id', { count: 'exact', head: true }).in('country_code', euCodes).neq('is_garbage', true).eq('sector', 'Payments');
  const { count: euBanking } = await sb.from('entities').select('id', { count: 'exact', head: true }).in('country_code', euCodes).neq('is_garbage', true).eq('sector', 'Banking');
  
  console.log('\n=== EU SECTOR BREAKDOWN ===');
  console.log('EU Crypto:', euCrypto);
  console.log('EU Payments:', euPayments);
  console.log('EU Banking:', euBanking);
}
check();
