import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as XLSX from 'xlsx';

const url = 'https://fintrac-canafe.canada.ca/msb-esm/reg-eng.xlsx';

async function main() {
  console.log('Downloading FINTRAC...');
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  const buf = await res.arrayBuffer();
  console.log(`Downloaded ${(buf.byteLength / 1024).toFixed(0)} KB`);

  const wb = XLSX.read(buf, { type: 'array' });
  console.log('Sheets:', wb.SheetNames);

  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: '' });

  // Show column names
  const cols = Object.keys(rows[0] ?? {});
  console.log('\nColumns:', cols);

  // Show first 3 rows
  console.log('\nFirst 3 rows:');
  rows.slice(0, 3).forEach((r, i) => {
    console.log(`Row ${i}:`, JSON.stringify(r).substring(0, 300));
  });

  // Search for any row containing "virtual" or "crypto" or "digital"
  const cryptoRows = rows.filter((r) => {
    const vals = Object.values(r).join(' ').toLowerCase();
    return vals.includes('virtual') || vals.includes('crypto') || vals.includes('digital currency');
  });
  console.log(`\nRows containing crypto keywords: ${cryptoRows.length}`);

  if (cryptoRows.length > 0) {
    console.log('First crypto row:', JSON.stringify(cryptoRows[0]).substring(0, 500));
  }

  // Check all unique values in each column that might be "activities"
  for (const col of cols) {
    const lower = col.toLowerCase();
    if (lower.includes('activ') || lower.includes('service') || lower.includes('type') || lower.includes('class')) {
      const unique = [...new Set(rows.map((r) => r[col]).filter(Boolean))].slice(0, 15);
      console.log(`\nColumn "${col}" sample values:`, unique);
    }
  }
}

main().catch(console.error);
