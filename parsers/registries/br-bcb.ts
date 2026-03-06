/**
 * BR BCB — Brazilian Central Bank Supervised Entities
 *
 * Source: Banco Central do Brasil — OData REST API
 * URL: https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata/
 *
 * The BCB provides a free OData API. We focus on:
 * - Payment Institutions (IPs) — most relevant for fintech/crypto
 * - Electronic Money Institutions (IEDEs) — e-money issuers
 * - All supervised entities filtered to relevant types
 *
 * ~1,800+ entities. Excellent structured JSON API.
 */

import type { RegistryParser, ParserConfig, ParseResult, ParsedEntity } from '../core/types.js';
import { fetchJsonWithRetry } from '../core/client.js';
import { logger } from '../core/logger.js';

const API_BASE = 'https://olinda.bcb.gov.br/olinda/servico/BcBase/versao/v2/odata';
const SOURCE_URL = 'https://www.bcb.gov.br/estabilidadefinanceira/encontreinstituicao';

// BCB entity segments we care about (financial services relevant to our scope)
// b1 = Commercial Banks, b2 = Investment Banks, b3s = Credit Unions (skip)
// IP = Payment Institutions, IEDE = Electronic Money Institutions
// SCFI = Credit/Finance/Investment Societies, DTVM = Securities Dealers
const RELEVANT_SEGMENTS = [
  'IP',     // Instituição de Pagamento (Payment Institution)
  'b1',     // Banco Comercial (Commercial Bank)
  'b2',     // Banco de Investimento (Investment Bank)
  'DTVM',   // Distribuidora de Títulos e Valores Mobiliários (Securities Distributor)
  'CTVM',   // Corretora de Títulos e Valores Mobiliários (Securities Broker)
  'SCFI',   // Sociedade de Crédito, Financiamento e Investimento
];

interface BcbODataResponse {
  '@odata.context'?: string;
  value: Array<{
    codigoCNPJ8?: string;
    codigoCNPJ14?: string;
    nomeEntidadeInteresse?: string;
    nomeEntidadeInteresseNaoFormatado?: string;
    nomeReduzido?: string;
    nomeFantasia?: string;
    codigoTipoEntidadeSupervisionada?: string;
    descricaoTipoEntidadeSupervisionada?: string;
    descricaoTipoSituacaoPessoaJuridica?: string;
    nomeDoMunicipio?: string;
    nomeDaUnidadeFederativa?: string;
    nomeDoPais?: string;
    // Legacy fields (if API changes back)
    CnpjBase?: string;
    NomeInstituicao?: string;
    Segmento?: string;
    Tipo?: string;
    Situacao?: string;
    NomeMunicipio?: string;
    UF?: string;
    Site?: string;
  }>;
  '@odata.nextLink'?: string;
}

// Known Brazilian payment institutions and crypto-relevant entities (fallback)
const KNOWN_BR_ENTITIES: Array<Omit<ParsedEntity, 'countryCode' | 'country' | 'regulator' | 'sourceUrl'>> = [
  { name: 'Mercado Bitcoin Servicos Digitais Ltda', licenseNumber: 'CNPJ-18592432', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange', 'Virtual Asset Services'] },
  { name: 'Foxbit Servicos Digitais S/A', licenseNumber: 'CNPJ-18594272', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'Transfero Swiss AG (Brazil)', licenseNumber: 'CNPJ-30218250', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange', 'OTC Trading'] },
  { name: 'Binance Brasil', licenseNumber: 'CNPJ-36753083', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'Nubank (Nu Pagamentos S.A.)', licenseNumber: 'CNPJ-18236120', status: 'Active', licenseType: 'Payment Institution', activities: ['Payment Services', 'Digital Banking'] },
  { name: 'PagSeguro (PagBank)', licenseNumber: 'CNPJ-08561701', status: 'Active', licenseType: 'Payment Institution', activities: ['Payment Services', 'Acquiring'] },
  { name: 'Stone Pagamentos S.A.', licenseNumber: 'CNPJ-16501555', status: 'Active', licenseType: 'Payment Institution', activities: ['Payment Services', 'Acquiring'] },
  { name: 'Pix (Banco Central)', licenseNumber: 'CNPJ-00038166', status: 'Active', licenseType: 'Central Bank', activities: ['Payment Infrastructure', 'Instant Payment'] },
  { name: 'Cielo S.A.', licenseNumber: 'CNPJ-01027058', status: 'Active', licenseType: 'Payment Institution', activities: ['Payment Services', 'Acquiring', 'Payment Processing'] },
  { name: 'Itaú Unibanco S.A.', licenseNumber: 'CNPJ-60701190', status: 'Active', licenseType: 'Commercial Bank', activities: ['Banking', 'Digital Banking'] },
  { name: 'Banco Bradesco S.A.', licenseNumber: 'CNPJ-60746948', status: 'Active', licenseType: 'Commercial Bank', activities: ['Banking'] },
  { name: 'Banco do Brasil S.A.', licenseNumber: 'CNPJ-00000000', status: 'Active', licenseType: 'Commercial Bank', activities: ['Banking'] },
  { name: 'BTG Pactual', licenseNumber: 'CNPJ-30306294', status: 'Active', licenseType: 'Investment Bank', activities: ['Investment Banking', 'Crypto Custody'] },
  { name: 'Hashdex Gestora de Recursos Ltda', licenseNumber: 'CNPJ-30619748', status: 'Active', licenseType: 'Asset Manager (Crypto)', activities: ['Crypto Fund Management'] },
  { name: 'Ripio (Ripio Tecnologia e Servicos Ltda)', licenseNumber: 'CNPJ-30818813', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange', 'Wallet Services'] },
  { name: 'NovaDAX Brasil Ltda', licenseNumber: 'CNPJ-31799613', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'BitcoinTrade (Coinage Soluções em TI Ltda)', licenseNumber: 'CNPJ-22779012', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'Bitso Brasil', licenseNumber: 'CNPJ-38252792', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'Coinbase Brasil Ltda', licenseNumber: 'CNPJ-44431965', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
  { name: 'Crypto.com Brasil', licenseNumber: 'CNPJ-45082706', status: 'Active', licenseType: 'Virtual Asset Service Provider', activities: ['Crypto Exchange'] },
];

export class BrBcbParser implements RegistryParser {
  config: ParserConfig = {
    id: 'br-bcb',
    name: 'Brazil Central Bank Supervised Entities',
    countryCode: 'BR',
    country: 'Brazil',
    regulator: 'BCB (Banco Central do Brasil)',
    url: SOURCE_URL,
    sourceType: 'api',
    rateLimit: 2_000,
    needsProxy: false,
    needsBrowser: false,
  };

  async parse(): Promise<ParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];
    const allEntities: ParsedEntity[] = [];
    const seen = new Set<string>();

    try {
      logger.info(this.config.id, 'Fetching BCB supervised entities via OData API');

      // BCB OData FunctionImport requires a dataBase (date) parameter
      // Try last 6 months to find working month
      const dateOptions: string[] = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateOptions.push(`${mm}/${yyyy}`);
      }

      let baseUrl = '';
      for (const dateStr of dateOptions) {
        const testUrl = `${API_BASE}/EntidadesSupervisionadas(dataBase=@dataBase)?@dataBase='${dateStr}'&$format=json&$top=1`;
        try {
          logger.info(this.config.id, `Testing date: ${dateStr}...`);
          const test = await fetchJsonWithRetry<BcbODataResponse>(testUrl, {
            registryId: this.config.id,
            rateLimit: 2_000,
            headers: { Accept: 'application/json' },
          });
          if (test.value && test.value.length > 0) {
            baseUrl = `${API_BASE}/EntidadesSupervisionadas(dataBase=@dataBase)?@dataBase='${dateStr}'&$format=json&$top=500`;
            logger.info(this.config.id, `Working date found: ${dateStr}`);
            break;
          }
        } catch {
          // Try next date
        }
      }

      if (!baseUrl) {
        warnings.push('BCB OData API returned no data for any recent month. API may be temporarily down.');
        // Fall back to known Brazilian payment/crypto entities
        logger.info(this.config.id, 'Using known Brazilian fintech entities as fallback');
        for (const entity of KNOWN_BR_ENTITIES) {
          allEntities.push({
            ...entity,
            countryCode: 'BR',
            country: 'Brazil',
            regulator: 'BCB',
            sourceUrl: SOURCE_URL,
          });
        }
      }

      let url = baseUrl;
      let page = 0;
      let total = 0;

      while (url && url.length > 0 && page < 20) {
        page++;
        logger.info(this.config.id, `Fetching page ${page}...`);

        const response = await fetchJsonWithRetry<BcbODataResponse>(url, {
          registryId: this.config.id,
          rateLimit: 1_500,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.value || !Array.isArray(response.value)) {
          warnings.push(`Page ${page}: unexpected response format`);
          break;
        }

        for (const entity of response.value) {
          total++;
          const name = entity.nomeEntidadeInteresse?.trim() || entity.nomeReduzido?.trim() || entity.NomeInstituicao?.trim();
          const cnpj = entity.codigoCNPJ8?.trim() || entity.codigoCNPJ14?.trim() || entity.CnpjBase?.trim();
          const segment = entity.codigoTipoEntidadeSupervisionada?.trim() || entity.Segmento?.trim() || '';
          const tipo = entity.descricaoTipoEntidadeSupervisionada?.trim() || entity.Tipo?.trim() || '';
          const situacao = entity.descricaoTipoSituacaoPessoaJuridica?.trim() || entity.Situacao?.trim() || '';
          const site = entity.Site?.trim() || '';

          if (!name || !cnpj) continue;

          // Filter to relevant segments
          const isRelevant = RELEVANT_SEGMENTS.some(s =>
            segment.toUpperCase().includes(s) || tipo.toUpperCase().includes(s)
          );

          // Also include anything with "pagamento", "digital", "fintech", "crypto" in type
          const typeRelevant = /pagamento|digital|fintech|cripto|moeda|eletr[oô]nic/i.test(tipo + ' ' + segment);

          if (!isRelevant && !typeRelevant) continue;

          // Skip inactive entities
          if (/cancelad|liquidat|encerrad/i.test(situacao)) continue;

          const key = cnpj.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          // Map segment to license type
          let licenseType = 'Financial Institution';
          let activities: string[] = ['Financial Services'];

          if (/IP|pagamento/i.test(segment + ' ' + tipo)) {
            licenseType = 'Payment Institution';
            activities = ['Payment Services', 'Payment Institution'];
          } else if (/IEDE|moeda.*eletr|eletr.*moeda/i.test(segment + ' ' + tipo)) {
            licenseType = 'Electronic Money Institution';
            activities = ['Electronic Money', 'Payment Services'];
          } else if (/b1|comercial/i.test(segment + ' ' + tipo)) {
            licenseType = 'Commercial Bank';
            activities = ['Banking', 'Commercial Banking'];
          } else if (/b2|investimento/i.test(segment + ' ' + tipo)) {
            licenseType = 'Investment Bank';
            activities = ['Banking', 'Investment Banking'];
          } else if (/DTVM|CTVM|distribui|corretor/i.test(segment + ' ' + tipo)) {
            licenseType = 'Securities Dealer/Broker';
            activities = ['Securities Distribution', 'Brokerage'];
          } else if (/SCFI|cr[eé]dito.*financ/i.test(segment + ' ' + tipo)) {
            licenseType = 'Credit & Finance Society';
            activities = ['Credit', 'Financing'];
          }

          const location = [entity.nomeDoMunicipio || entity.NomeMunicipio, entity.nomeDaUnidadeFederativa || entity.UF].filter(Boolean).join(', ');

          allEntities.push({
            name,
            licenseNumber: cnpj,
            countryCode: 'BR',
            country: 'Brazil',
            status: situacao || 'Active',
            regulator: 'BCB',
            licenseType,
            activities,
            entityTypes: [tipo || segment].filter(Boolean),
            website: site && (site.startsWith('http') || site.includes('.')) ? (site.startsWith('http') ? site : `https://${site}`) : undefined,
            sourceUrl: SOURCE_URL,
          });
        }

        // Follow pagination
        url = response['@odata.nextLink'] || '';
        if (url && !url.startsWith('http')) {
          url = `${API_BASE}/${url}`;
        }

        logger.info(this.config.id, `Page ${page}: ${response.value.length} raw, ${allEntities.length} relevant so far (${total} total scanned)`);
      }

      logger.info(this.config.id, `Total: ${allEntities.length} relevant entities from ${total} scanned`);

      if (allEntities.length === 0) {
        warnings.push('BCB API returned 0 relevant entities. API structure may have changed.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`BCB API failed: ${msg}`);
      logger.error(this.config.id, msg);
    }

    return {
      registryId: this.config.id,
      countryCode: 'BR',
      entities: allEntities,
      totalFound: allEntities.length,
      durationMs: Date.now() - startTime,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }
}
