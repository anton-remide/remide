/**
 * Registry / Regulator domain detection.
 *
 * Used across the pipeline to prevent government registry pages from being
 * treated as company websites. A URL that matches here should be stored in
 * `registry_url` (or `source_url`), never in `website`.
 *
 * Consumed by: parsers, website-discovery, quality worker, enrichment.
 */

const REGISTRY_HOST_FRAGMENTS: string[] = [
  // Singapore — MAS FID
  'eservices.mas.gov.sg',
  // Gibraltar — GFSC
  'gfsc.gi',
  // UK — FCA
  'register.fca.org.uk',
  'fca.org.uk/firms',
  // Germany — BaFin
  'portal.mvp.bafin.de',
  'bafin.de',
  // France — AMF / ACPR
  'geco.amf-france.org',
  'amf-france.org',
  'acpr.banque-france.fr',
  // Spain — CNMV
  'cnmv.es',
  // Italy — CONSOB / Banca d'Italia / OAM
  'consob.it',
  'bancaditalia.it',
  'organismo-am.it',
  // Netherlands — DNB / AFM
  'dnb.nl',
  'afm.nl',
  // Switzerland — FINMA
  'finma.ch',
  // Austria — FMA
  'fma.gv.at',
  // Liechtenstein — FMA-LI
  'register.fma-li.li',
  'fma-li.li',
  // Poland — KNF
  'knf.gov.pl',
  // Czech Republic — CNB
  'cnb.cz',
  // Sweden — FI
  'fi.se',
  // Norway — Finanstilsynet
  'finanstilsynet.no',
  // Denmark — DFSA
  'finanstilsynet.dk',
  'dfsa.dk',
  // Finland — FIN-FSA
  'finanssivalvonta.fi',
  'fin-fsa.fi',
  // Ireland — CBI
  'registers.centralbank.ie',
  'centralbank.ie',
  // Luxembourg — CSSF
  'cssf.lu',
  // Belgium — FSMA
  'fsma.be',
  // EU-level — ESMA / EBA
  'esma.europa.eu',
  'euclid.eba.europa.eu',
  'eba.europa.eu',
  // Australia — AUSTRAC
  'austrac.gov.au',
  // Canada — FINTRAC
  'fintrac-canafe.gc.ca',
  // US regulators
  'nydfs.org',
  'dfs.ny.gov',
  'fincen.gov',
  'sec.gov',
  'fdic.gov',
  'occ.gov',
  // Hong Kong — SFC
  'sfc.hk',
  // Japan — FSA / JFSA
  'fsa.go.jp',
  // South Korea — FIU / FSC
  'fiu.go.kr',
  'fsc.go.kr',
  // India — FIU / RBI / SEBI
  'fiuindia.gov.in',
  'rbi.org.in',
  'sebi.gov.in',
  // UAE — VARA / ADGM / DFSA
  'vara.ae',
  'adgm.com/public-registers',
  'dfsa.ae',
  // Bahrain — CBB
  'cbb.gov.bh',
  // Thailand — SEC
  'sec.or.th',
  // Malaysia — SC
  'sc.com.my',
  // Philippines — BSP
  'bsp.gov.ph',
  // Indonesia — OJK
  'ojk.go.id',
  // South Africa — FSCA
  'fsca.co.za',
  // Nigeria — SEC
  'sec.gov.ng',
  // Brazil — BCB
  'bcb.gov.br',
  // Mexico — CNBV
  'cnbv.gob.mx',
  // Isle of Man — FSA
  'iomfsa.im',
  // Cayman Islands — CIMA
  'cima.ky',
  // Bermuda — BMA
  'bma.bm',
  // Turkey — SPK / CMB
  'spk.gov.tr',
  // Kazakhstan — AFSA
  'afsa.kz',
  // Seychelles — FSA
  'fsaseychelles.sc',
  // Mauritius — FSC
  'fscmauritius.org',
];

/**
 * Returns true when the URL belongs to a known regulatory registry
 * rather than the entity's actual corporate website.
 */
export function isRegistryUrl(url: string | null | undefined): boolean {
  if (!url || url.trim().length === 0) return false;

  let hostname: string;
  try {
    hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return false;
  }

  return REGISTRY_HOST_FRAGMENTS.some(
    (frag) => hostname === frag || hostname.endsWith(`.${frag}`),
  );
}

/**
 * Returns true when the URL path looks like a registry detail page
 * (institution detail, regulated-entity, etc.) — useful for catching
 * edge cases where the domain alone is ambiguous.
 */
export function isRegistryDetailPath(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url.startsWith('http') ? url : `https://${url}`).pathname.toLowerCase();
    const patterns = [
      '/fid/institution/detail/',
      '/regulated-entity/',
      '/register/',
      '/public-register/',
      '/firms/',
      '/entity/',
    ];
    return patterns.some((p) => path.includes(p));
  } catch {
    return false;
  }
}

/**
 * Combined check: URL is from a registry domain AND has a detail-page path.
 * This is the strictest check — minimises false positives.
 */
export function isRegistryWebsite(url: string | null | undefined): boolean {
  return isRegistryUrl(url);
}
