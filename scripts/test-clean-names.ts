/**
 * Quick test: verify cleanName() and detectGarbage() fixes
 * Run: npx tsx scripts/test-clean-names.ts
 */

import { cleanName, detectGarbage, type QualityInput } from '../workers/quality/rules.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function test(label: string, got: string, expected: string) {
  if (got === expected) {
    console.log(`  ${GREEN}✓${RESET} ${label}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${label}`);
    console.log(`    expected: "${expected}"`);
    console.log(`    got:      "${got}"`);
    failed++;
  }
}

function testGarbage(label: string, name: string, expectGarbage: boolean) {
  const entity = { id: 'test', name, country_code: 'XX', license_number: '', license_type: null, entity_types: [], activities: [], status: 'Active', regulator: null, website: null, description: null, linkedin_url: null, parser_id: null, crypto_status: null, is_garbage: false, quality_score: 0 } as QualityInput;
  const result = detectGarbage(entity);
  if (result.isGarbage === expectGarbage) {
    console.log(`  ${GREEN}✓${RESET} ${label} → garbage=${result.isGarbage}${result.reason ? ` (${result.reason})` : ''}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${label} → expected garbage=${expectGarbage}, got ${result.isGarbage}${result.reason ? ` (${result.reason})` : ''}`);
    failed++;
  }
}

console.log('\n=== cleanName() tests ===\n');

// Polish double-comma quotes
test('Polish ,,ARTI\'\' prefix', cleanName(',,ARTI\'\' - FUH Adam Szczechowiak'), 'ARTI - FUH Adam Szczechowiak');
test('Polish ,,TUKAN\'\' with legal suffix', cleanName(',,TUKAN\'\' Ewa i Dariusz Kamińscy spółka jawna'), 'TUKAN Ewa i Dariusz Kamińscy');
test('Polish ,,ELIXIR" mixed quotes', cleanName(',,ELIXIR" ELŻBIETA DEMBSKA'), 'Elixir Elżbieta Dembska');

// Polish „ opening quote
test('Polish „AGI" quotes', cleanName('„AGI" BEATA ŚLEBIODA'), 'Agi Beata Ślebioda');
test('Polish „MODEW" quotes', cleanName('„MODEW" Modrzyńska Ewa'), 'MODEW Modrzyńska Ewa');
test('Polish „Sebos" quotes', cleanName('„Sebos" P.P.H.U. Sebastian Hinczewski'), 'Sebos P.P.H.U. Sebastian Hinczewski');

// Regular double quotes (already working but verify)
test('Regular "ABC" quotes', cleanName('"ABC" - Zdzisław Bonkowski'), 'ABC - Zdzisław Bonkowski');
test('Regular "AGAMA" quotes', cleanName('"AGAMA" Sklep RTV Agnieszka Matacz'), 'AGAMA Sklep RTV Agnieszka Matacz');

// ALL-CAPS Polish
test('ALL-CAPS Polish', cleanName('"AGATOM" RODZINNE OPŁATY TOMASZ PRUSAK'), 'Agatom Rodzinne Opłaty Tomasz Prusak');

// NYDFS trailing comma after suffix removal
test('NYDFS Inc. suffix', cleanName('Coinbase, Inc.'), 'Coinbase');
test('NYDFS LLC suffix', cleanName('Anchorage Digital NY, LLC'), 'Anchorage Digital NY');
test('NYDFS LLC suffix 2', cleanName('Zero Hash LLC'), 'Zero Hash');
test('NYDFS Trust Company, LLC', cleanName('Gemini Trust Company, LLC'), 'Gemini Trust Company');

// NYDFS trailing asterisk
test('Trailing asterisk', cleanName('Gemini Dollar*'), 'Gemini Dollar');
test('Trailing asterisks', cleanName('GMO JPY*'), 'GMO JPY');
test('GMO USD*', cleanName('GMO USD*'), 'GMO USD');

// NYDFS f/k/a handling
test('f/k/a removal', cleanName('Block, Inc., f/k/a Square, Inc.'), 'Block');
test('f/k/a in parentheses', cleanName('Ripple Markets DE LLC (f/k/a XRP II LLC)'), 'Ripple Markets DE');

// Markdown bold stripping (not ALL-CAPS, so no title-casing)
test('Markdown ** prefix', cleanName('**The Department granted Provenance Technologies'), 'The Department granted Provenance Technologies');

// d/b/a handling — Inc. stays because it's in the middle, not at end
test('d/b/a preserved', cleanName('Moon Inc. d/b/a LibertyX'), 'Moon Inc. d/b/a LibertyX');

// Edge cases
test('Empty after cleaning → return raw', cleanName('(FKA Seed Digital Commodity Market, LLC)'), '(FKA Seed Digital Commodity Market, LLC)');
test('Normal name unchanged', cleanName('Coinbase'), 'Coinbase');
test('Normal name with comma', cleanName('PayPal Digital, Inc.'), 'PayPal Digital');

console.log('\n=== detectGarbage() tests ===\n');

// Fixed patterns
testGarbage('"- -" is garbage', '- -', true);
testGarbage('"–  –" is garbage', '–  –', true);
testGarbage('". ." is garbage', '. .', true);
testGarbage('"---" is garbage', '---', true);

// ISO dates
testGarbage('"2024-01-15" is garbage', '2024-01-15', true);
testGarbage('"2018-02-07" is garbage', '2018-02-07', true);

// Parenthetical-only
testGarbage('"(FKA Seed...)" is garbage', '(FKA Seed Digital Commodity Market, LLC)', true);

// Description-as-name
testGarbage('NYDFS markdown description', '**The Department granted Provenance Technologies, Inc. a money transmitter license in October 2021 and the virtual currency license in February 2022.', true);
testGarbage('NYDFS description with *', '*The Department granted PayPal, Inc. a conditional virtual currency license in October 2020 and a money transmitter license in October 2013.', true);

// Coin names as entities
testGarbage('"Bitcoin" is garbage', 'Bitcoin', true);
testGarbage('"Ethereum" is garbage', 'Ethereum', true);

// Real entity names should NOT be garbage
testGarbage('Coinbase is NOT garbage', 'Coinbase', false);
testGarbage('PayPal is NOT garbage', 'PayPal', false);
testGarbage('Real Polish name', 'ARTI - FHU Adam Szczechowiak', false);
testGarbage('Normal LLC name', 'Anchorage Digital NY, LLC', false);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
