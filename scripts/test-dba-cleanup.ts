import { cleanName } from '../workers/quality/rules.js';

const tests: Array<[string, string]> = [
  // DBA clause - KZ-AFSA (curly quotes + doing business in AIFC)
  ['\u201CTengri Partners Investment Banking (Kazakhstan)\u201D JSC doing business in the AIFC as \u201CTengri Partners Investment Banking (AIFC)\u201D',
   'Tengri Partners Investment Banking'],
  // DBA clause - simple
  ['China Construction Bank Corporation doing business in the AIFC as China Construction Bank Corporation Astana Branch',
   'China Construction Bank Corporation'],
  // Subsidiary Organization prefix
  ['Subsidiary Organization of Halyk Bank of Kazakhstan Halyk Finance JSC doing business in the AIFC as Halyk Finance Astana',
   'Halyk Bank of Kazakhstan Halyk Finance'],
  // d/b/a
  ['Moon Inc. d/b/a LibertyX', 'Moon'],
  // T/A
  ['Aux Cayes FinTech Co. Ltd T/A OKX', 'Aux Cayes FinTech'],
  // trading as
  ['Stratos Tech Limited trading as Tradu', 'Stratos Tech'],
  // JSC suffix
  ['JSC Altyn Bank', 'Altyn Bank'],
  // Blackfort - simple DBA
  ['Blackfort Capital AG doing business in the AIFC as Representative Office of Blackfort Capital',
   'Blackfort Capital'],
  // Clarus
  ['Clarus Capital Group AG doing business in the AIFC as Representative Office of Clarus Capital Group AG',
   'Clarus Capital Group'],
  // Hungarian Export-Import Bank
  ['Hungarian Export-Import Bank Private Limited Company doing business in the AIFC as Representative Office of Eximbank in Nur-Sultan',
   'Hungarian Export-Import Bank'],
  // d.b.a.
  ['PayPal Inc. d.b.a. Venmo', 'PayPal'],
  // Existing f/k/a should still work
  ['Block, Inc., f/k/a Square, Inc.', 'Block'],
  // Bybit T/A
  ['Bybit Technology Limited T/A BYBIT', 'Bybit Technology'],
  // US FDIC d/b/a
  ['Transportation Alliance Bank, Inc. d/b/a TAB Bank', 'Transportation Alliance Bank'],
  // US NYDFS d/b/a
  ['Provenance Technologies, Inc. d/b/a Fiant', 'Provenance Technologies'],
  // HDR/BitMEX
  ['HDR Global Trading Limited T/A Bitmex', 'HDR Global Trading'],
];

console.log('=== cleanName() DBA tests ===\n');
let pass = 0, fail = 0;
for (const [input, expected] of tests) {
  const result = cleanName(input);
  const ok = result === expected;
  if (!ok) {
    console.log(`FAIL: "${input.substring(0, 70)}..."`);
    console.log(`  Expected: "${expected}"`);
    console.log(`  Got:      "${result}"`);
    fail++;
  } else {
    console.log(`PASS: "${expected}"`);
    pass++;
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
