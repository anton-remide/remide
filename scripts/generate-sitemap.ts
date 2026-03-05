/**
 * Build-time sitemap generator.
 *
 * Fetches all jurisdiction codes, entity IDs, stablecoin IDs, and CBDC IDs
 * from Supabase and generates a complete sitemap.xml with ~4250+ URLs.
 *
 * Usage:
 *   npx tsx scripts/generate-sitemap.ts
 *
 * Output: dist/sitemap.xml (overwrites the static version from public/)
 *
 * Run AFTER `npm run build` or integrate into CI/CD pipeline.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../shared/config.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://anton-remide.github.io/remide';

interface SitemapUrl {
  loc: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

async function generateSitemap(): Promise<void> {
  console.log('🗺️  Generating dynamic sitemap...');

  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  // Fetch all data in parallel
  const [jurisdictions, entities, stablecoins, cbdcs] = await Promise.all([
    supabase.from('jurisdictions').select('country_code').order('country_code'),
    supabase.from('entities').select('id').order('id'),
    supabase.from('stablecoins').select('id').order('id'),
    supabase.from('cbdcs').select('id').order('id'),
  ]);

  if (jurisdictions.error) throw new Error(`Jurisdictions: ${jurisdictions.error.message}`);
  if (entities.error) throw new Error(`Entities: ${entities.error.message}`);
  if (stablecoins.error) throw new Error(`Stablecoins: ${stablecoins.error.message}`);
  if (cbdcs.error) throw new Error(`CBDCs: ${cbdcs.error.message}`);

  const urls: SitemapUrl[] = [];

  // Static pages
  urls.push({ loc: `${BASE_URL}/`, changefreq: 'weekly', priority: 1.0 });
  urls.push({ loc: `${BASE_URL}/jurisdictions`, changefreq: 'weekly', priority: 0.9 });
  urls.push({ loc: `${BASE_URL}/entities`, changefreq: 'weekly', priority: 0.9 });
  urls.push({ loc: `${BASE_URL}/entities?tab=stablecoins`, changefreq: 'weekly', priority: 0.8 });
  urls.push({ loc: `${BASE_URL}/entities?tab=cbdcs`, changefreq: 'weekly', priority: 0.7 });
  urls.push({ loc: `${BASE_URL}/login`, changefreq: 'monthly', priority: 0.3 });
  urls.push({ loc: `${BASE_URL}/signup`, changefreq: 'monthly', priority: 0.4 });

  // Dynamic jurisdiction pages
  for (const j of jurisdictions.data ?? []) {
    urls.push({
      loc: `${BASE_URL}/jurisdictions/${j.country_code}`,
      changefreq: 'weekly',
      priority: 0.7,
    });
  }

  // Dynamic entity pages
  for (const e of entities.data ?? []) {
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
  console.log(`   - ${7} static pages`);
  console.log(`   - ${(jurisdictions.data ?? []).length} jurisdictions`);
  console.log(`   - ${(entities.data ?? []).length} entities`);
  console.log(`   - ${(stablecoins.data ?? []).length} stablecoins`);
  console.log(`   - ${(cbdcs.data ?? []).length} CBDCs`);
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
