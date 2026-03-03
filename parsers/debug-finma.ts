/**
 * Debug script for ch-finma parser
 * Dumps Excel structure and content to help debug why 0 entities are found.
 *
 * Run: cd "/Users/antontitov/Vasp Tracker/remide" && npx tsx parsers/debug-finma.ts
 */

import * as XLSX from 'xlsx';

const FINTECH_URL = 'https://www.finma.ch/en/~/media/finma/dokumente/bewilligungstraeger/xlsx/fintech.xlsx';
const BANKS_URL = 'https://www.finma.ch/en/~/media/finma/dokumente/bewilligungstraeger/xlsx/beh.xlsx';

const CRYPTO_KEYWORDS = ['crypto', 'virtual', 'blockchain', 'dlt', 'digital asset', 'bitcoin', 'token',
  'seba', 'sygnum', 'amina', 'leonteq', '21shares', 'taurus'];

async function debugExcel(label: string, url: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${label}`);
  console.log(`  URL: ${url}`);
  console.log('='.repeat(80));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    });
  } catch (err) {
    console.error(`  FETCH ERROR: ${err}`);
    return;
  }

  console.log(`\n  HTTP Status: ${response.status} ${response.statusText}`);
  console.log(`  Content-Type: ${response.headers.get('content-type')}`);
  console.log(`  Content-Length: ${response.headers.get('content-length')}`);

  if (!response.ok) {
    const body = await response.text().catch(() => '(could not read body)');
    console.error(`  Response body (first 500 chars): ${body.substring(0, 500)}`);
    return;
  }

  const buffer = await response.arrayBuffer();
  console.log(`  Downloaded bytes: ${buffer.byteLength}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch (err) {
    console.error(`  XLSX PARSE ERROR: ${err}`);
    // Try reading as HTML (sometimes FINMA returns HTML)
    const text = new TextDecoder().decode(buffer);
    console.log(`  Raw content (first 1000 chars):\n${text.substring(0, 1000)}`);
    return;
  }

  console.log(`\n  Sheet names: ${JSON.stringify(workbook.SheetNames)}`);

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n  --- Sheet: "${sheetName}" ---`);
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.log('    (empty sheet)'); continue; }

    const ref = sheet['!ref'];
    console.log(`  Range: ${ref || '(no range)'}`);

    // Get all rows as JSON
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: '',
    });
    console.log(`  Total rows (as JSON): ${rows.length}`);

    if (rows.length === 0) {
      // Dump raw cells
      console.log('\n  Raw cell dump (first 50 cells):');
      const keys = Object.keys(sheet).filter(k => !k.startsWith('!')).slice(0, 50);
      for (const k of keys) {
        console.log(`    ${k}: ${JSON.stringify(sheet[k]?.v)} (type: ${sheet[k]?.t})`);
      }
      continue;
    }

    // Column names
    const columns = Object.keys(rows[0]!);
    console.log(`  Columns (${columns.length}): ${JSON.stringify(columns)}`);

    // First 3 rows
    console.log('\n  First 3 rows:');
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`    Row ${i}: ${JSON.stringify(rows[i])}`);
    }

    // Search for crypto-related rows
    console.log(`\n  Searching for crypto keywords: ${CRYPTO_KEYWORDS.join(', ')}`);
    const matches: { rowIndex: number; keyword: string; row: Record<string, unknown> }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowText = Object.values(rows[i]!).join(' ').toLowerCase();
      for (const kw of CRYPTO_KEYWORDS) {
        if (rowText.includes(kw)) {
          matches.push({ rowIndex: i, keyword: kw, row: rows[i]! });
          break; // one match per row is enough
        }
      }
    }

    console.log(`  Keyword matches: ${matches.length}`);
    for (const m of matches) {
      console.log(`    Row ${m.rowIndex} [${m.keyword}]: ${JSON.stringify(m.row)}`);
    }

    // Check if Name/Institution columns exist
    const nameColumns = ['Name', 'Institution', 'Firma', 'name', 'institution'];
    const foundNameCols = nameColumns.filter(nc =>
      columns.some(c => c.toLowerCase() === nc.toLowerCase())
    );
    console.log(`\n  Name column candidates found: ${JSON.stringify(foundNameCols)}`);
    if (foundNameCols.length === 0) {
      console.log('  WARNING: No standard name column found! The parser will skip all rows.');
      console.log('  Available columns for reference:', columns.map(c => `"${c}"`).join(', '));
    }
  }
}

async function main() {
  console.log('FINMA Parser Debug Tool');
  console.log(`Date: ${new Date().toISOString()}`);

  await debugExcel('FINTECH LICENCE HOLDERS', FINTECH_URL);
  await debugExcel('BANKS & SECURITIES FIRMS', BANKS_URL);

  console.log('\n\nDone.');
}

main().catch(console.error);
