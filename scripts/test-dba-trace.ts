/**
 * Step-by-step trace of cleanName() for Tengri entity
 */

const raw = '\u201CTengri Partners Investment Banking (Kazakhstan)\u201D JSC doing business in the AIFC as \u201CTengri Partners Investment Banking (AIFC)\u201D';

console.log('Raw input:');
console.log(' ', raw);
console.log('  Hex of first 3 chars:', [...raw.slice(0, 3)].map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' '));

let name = raw.trim();

// Step 1: Quote stripping (line 168 of rules.ts)
const quoteRegex = /["\u201C\u201D\u201E\u201F\u2018\u2019\u201A\u201B\u00AB\u00BB\u2039\u203A\u0060\u02BA\u02EE\u02DD\uFF02\uFF07]/g;
const afterQuotes = name.replace(quoteRegex, '');
console.log('\nStep 1 (quote strip):', afterQuotes);

// Step 2: DBA strip
const afterDba = afterQuotes.replace(/\s+doing\s+business\s+(?:in\s+.+?\s+)?as\s+.+$/i, '').trim();
console.log('Step 2 (DBA strip):', afterDba);

// Step 3: JSC suffix strip
const afterJsc = afterDba.replace(/\s*\b(JSC|OJSC|PJSC|CJSC|Joint[- ]Stock\s+Company)\s*$/i, '').trim();
console.log('Step 3 (JSC strip):', afterJsc);

// Step 4: Trailing parens strip
const afterParens = afterJsc.replace(/\s*\([^)]*\)\s*$/, '').trim();
console.log('Step 4 (parens strip):', afterParens);

// Now test actual cleanName
import { cleanName } from '../workers/quality/rules.js';
console.log('\nActual cleanName result:', cleanName(raw));
console.log('  Hex:', [...cleanName(raw)].slice(0, 5).map(c => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' '));
