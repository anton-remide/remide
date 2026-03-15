import { cleanName } from '../workers/quality/rules.js';

// Test Polish names from EBA register
const testNames = [
  'Pośrednictwo Finansowe "Transfer" Sławomir Jańczyk',
  '"PAPIEREK PL" Krystyna Mazurek',
  'Przedsiębiorstwo Produkcyjne Usługowe i Handlowe "SPARTAN" Sp. z o.o.',
  'USŁUGI RACHUNKOWO-FINANSOWE "OLIMPIA" IZABELA HAKE (d. Usługi Rachunkowo-Finansowe "OLIMPIA" Izabela Trzebiatowska)',
  'ANNA ŚLUSARCZYK FIRMA HANDLOWA "AMADI"',
  'NEW PAYMENT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ (d. NEW PAYMENT spółka z ograniczoną odpowiedzialnością w likwidacji)',
  'FLEXEE BENEFITS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  'KURS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  'KAR - TEL II SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ (d. KAR-TEL spółka z ograniczoną odpowiedzialnością)',
  'DAN-ROL SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  'Grupa "LEW" Spółka Akcyjna',
  'F.H.U.P "SAGA" Grzegorz Sałustowicz',
  'PRZEDSIĘBIORSTWO PRODUKCYJNO - HANDLOWO - ­USŁUGOWE I  FINANSOWE­ - RAFAŁ GRZYBOWSKI',
  'ADAS-TEL Adam Młynarczyk',
  'PayU S.A.',
  'FINANS TOMASZ HEBZDA',
  'Bella Villa DANIEL DROZDEK-CHMIELEWSKI',
  'CITY CASH Tomasz Pęciak',
  'BOSKO KATARZYNA JEZIOREK',
];

console.log('=== Polish Name Cleanup Test ===\n');
for (const name of testNames) {
  const cleaned = cleanName(name);
  const changed = cleaned !== name.trim() ? '  ✓ CLEANED' : '';
  console.log(`IN:  "${name}"`);
  console.log(`OUT: "${cleaned}"${changed}`);
  console.log('');
}
