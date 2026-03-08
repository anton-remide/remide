/**
 * Quick test for quality rules — run with:
 *   npx tsx workers/quality/test-rules.ts
 */
import { cleanName, detectGarbage } from './rules.js';

interface Test {
  input: string;
  expected?: string;
  garbage?: boolean;
  country_code?: string;
}

const tests: Test[] = [
  // Trailing parentheticals stripped (correct: canonical name = "Binance", parenthetical is context)
  { input: 'Binance (Pakistan -- P2P)', expected: 'Binance' },
  { input: 'Binance (Morocco \u2014 P2P)', expected: 'Binance' },
  // Dash normalization (no trailing parenthetical = dash normalizes mid-string)
  { input: 'Company A -- Branch B', expected: 'Company A \u2013 Branch B' },

  // Smart quote normalization
  { input: 'Brink\u2019s Payment Services', expected: "Brink's Payment Services" },

  // Double comma collapse
  { input: 'Company,, City', expected: 'Company, City' },

  // ALL CAPS normalization
  { input: 'AFRICAN CRYPTO EXCHANGE', expected: 'African Crypto Exchange' },
  { input: 'SILO FINANCIAL SERVICES', expected: 'Silo Financial Services' },

  // Known acronyms stay uppercase
  { input: 'GBA LLC', expected: 'GBA' }, // LLC stripped, GBA is 3-char uppercase

  // Garbage: AUSTRAC dates
  { input: '1 October 2021', garbage: true },
  { input: '10 February 2022', garbage: true },
  { input: '28 March 2024', garbage: true },

  // Garbage: CONSOB gibberish
  { input: '03wakih', garbage: true },
  { input: '12DEF', garbage: true },
  { input: '01luhar', garbage: true },

  // Garbage: Canadian numbered companies
  { input: '1000224522 ONTARIO INC.', garbage: true },
  { input: '1035596 ALBERTA LTD', garbage: true },
  { input: '9876543 CANADA INC.', garbage: true },
  { input: '123456 B.C. LTD.', garbage: true },

  // Garbage: Quebec numbered companies (XXXX-XXXX Québec)
  { input: '9435-9643 Québec', garbage: true, country_code: 'CA' },
  { input: '9505-3948 Quebec', garbage: true, country_code: 'CA' },
  { input: '9148-7967 Quebec', garbage: true, country_code: 'CA' },

  // NOT garbage: companies with short number prefixes
  { input: '365 Finance', garbage: false },
  { input: '21Shares', garbage: false },

  // NOT garbage: real company names
  { input: 'IBM', garbage: false },
  { input: 'Coinbase', garbage: false },
  { input: 'Circle', garbage: false },
  { input: 'Blockchain.com', garbage: false },
];

let pass = 0;
let fail = 0;

for (const t of tests) {
  if (t.garbage !== undefined) {
    const result = detectGarbage({ name: t.input, country_code: t.country_code ?? '' } as any);
    const ok = result.isGarbage === t.garbage;
    const icon = ok ? '\u2705' : '\u274C';
    console.log(`${icon} garbage("${t.input}") \u2192 ${result.isGarbage} (${result.reason ?? 'not garbage'})`);
    if (ok) pass++;
    else fail++;
  } else if (t.expected !== undefined) {
    const result = cleanName(t.input);
    const ok = result === t.expected;
    const icon = ok ? '\u2705' : '\u274C';
    console.log(`${icon} clean("${t.input}") \u2192 "${result}"${!ok ? ` (expected: "${t.expected}")` : ''}`);
    if (ok) pass++;
    else fail++;
  }
}

console.log(`\n${pass}/${tests.length} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
