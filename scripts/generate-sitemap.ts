/**
 * Build-time sitemap generator.
 *
 * Fetches all jurisdiction codes, entity IDs, stablecoin IDs, CBDC IDs,
 * and issuer slugs from Supabase and generates a complete sitemap.xml.
 *
 * Usage:
 *   npx tsx scripts/generate-sitemap.ts
 *
 * Output: dist/sitemap.xml (overwrites the static version from public/)
 *
 * Run AFTER `npm run build` or integrate into CI/CD pipeline.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../shared/config.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://anton-remide.github.io/remide';

interface SitemapUrl {
  loc: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

/** Paginated fetch — Supabase limits to 1000 rows per request */
async function fetchAllIds(
  supabase: SupabaseClient,
  table: string,
  column: string,
): Promise<{ id: string | number }[]> {
  const PAGE = 1000;
  const all: { id: string | number }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    all.push(...data.map((row: Record<string, unknown>) => ({ id: row[column] as string | number })));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

async function generateSitemap(): Promise<void> {
  console.log('🗺️  Generating dynamic sitemap...');

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  // Fetch all data (entities use pagination due to 14K+ rows)
  const [jurisdictions, stablecoins, cbdcs] = await Promise.all([
    supabase.from('jurisdictions').select('code').order('code'),
    supabase.from('stablecoins').select('id').order('id'),
    supabase.from('cbdcs').select('id').order('id'),
  ]);

  if (jurisdictions.error) throw new Error(`Jurisdictions: ${jurisdictions.error.message}`);
  if (stablecoins.error) throw new Error(`Stablecoins: ${stablecoins.error.message}`);
  if (cbdcs.error) throw new Error(`CBDCs: ${cbdcs.error.message}`);

  // Entities need pagination (14K+)
  const entityIds = await fetchAllIds(supabase, 'entities', 'id');

  // Issuers — slug column may not exist if DDL 005 not applied
  let issuerSlugs: string[] = [];
  try {
    const { data, error } = await supabase
      .from('stablecoin_issuers')
      .select('slug')
      .not('slug', 'is', null)
      .order('slug');

    if (error) {
      console.warn(`⚠️  Issuers slug query failed: ${error.message}`);
    } else {
      issuerSlugs = (data ?? []).map((r: { slug: string }) => r.slug).filter(Boolean);
    }
  } catch {
    console.warn('⚠️  Issuers query skipped (slug column may not exist)');
  }

  const urls: SitemapUrl[] = [];

  // Static pages
  urls.push({ loc: `${BASE_URL}/`, changefreq: 'weekly', priority: 1.0 });
  urls.push({ loc: `${BASE_URL}/jurisdictions`, changefreq: 'weekly', priority: 0.9 });
  urls.push({ loc: `${BASE_URL}/entities`, changefreq: 'weekly', priority: 0.9 });
  urls.push({ loc: `${BASE_URL}/entities?tab=stablecoins`, changefreq: 'weekly', priority: 0.8 });
  urls.push({ loc: `${BASE_URL}/entities?tab=cbdcs`, changefreq: 'weekly', priority: 0.7 });
  urls.push({ loc: `${BASE_URL}/entities?tab=issuers`, changefreq: 'weekly', priority: 0.8 });
  urls.push({ loc: `${BASE_URL}/login`, changefreq: 'monthly', priority: 0.3 });
  urls.push({ loc: `${BASE_URL}/signup`, changefreq: 'monthly', priority: 0.4 });

  // Dynamic jurisdiction pages
  for (const j of jurisdictions.data ?? []) {
    urls.push({
      loc: `${BASE_URL}/jurisdictions/${j.code}`,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  // Dynamic entity pages
  for (const e of entityIds) {
    urls.push({
      loc: `${BASE_URL}/entities/${e.id}`,
      changefreq: 'weekly',
      priority: 0.5,
    });
  }

  // Dynamic stablecoin pages
  for (const s of stablecoins.data ?? []) {
    urls.push({
      loc: `${BASE_URL}/stablecoins/${s.id}`,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  // Dynamic CBDC pages
  for (const c of cbdcs.data ?? []) {
    urls.push({
      loc: `${BASE_URL}/cbdcs/${c.id}`,
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  // Dynamic issuer pages
  for (const slug of issuerSlugs) {
    urls.push({
      loc: `${BASE_URL}/issuers/${slug}`,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  // Generate XML
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) =>
      `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ),
    '</urlset>',
  ].join('\n');

  // Write to dist/
  const distDir = join(import.meta.dirname, '..', 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const outputPath = join(distDir, 'sitemap.xml');
  writeFileSync(outputPath, xml, 'utf-8');

  console.log(`✅ Sitemap generated: ${outputPath}`);
  console.log(`   ${urls.length} URLs total:`);
  console.log(`   - ${8} static pages`);
  console.log(`   - ${(jurisdictions.data ?? []).length} jurisdictions`);
  console.log(`   - ${entityIds.length} entities`);
  console.log(`   - ${(stablecoins.data ?? []).length} stablecoins`);
  console.log(`   - ${(cbdcs.data ?? []).length} CBDCs`);
  console.log(`   - ${issuerSlugs.length} issuers`);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

generateSitemap().catch((err) => {
  console.error('❌ Sitemap generation failed:', err);
  process.exit(1);
});
