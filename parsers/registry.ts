/**
 * Shared parser registry — single source of truth for all parser registrations.
 * Imported by run.ts, health-check.ts, and any future tooling.
 */

import type { RegistryParser } from './core/types.js';

import { ZaFscaParser } from './registries/za-fsca.js';
import { JpFsaParser } from './registries/jp-fsa.js';
import { FrAmfParser } from './registries/fr-amf.js';
import { DeBafinParser } from './registries/de-bafin.js';
import { AuAustracParser } from './registries/au-austrac.js';
import { SgMasParser } from './registries/sg-mas.js';
import { NlDnbParser } from './registries/nl-dnb.js';
import { ChFinmaParser } from './registries/ch-finma.js';
import { CaFintracParser } from './registries/ca-fintrac.js';
import { GbFcaParser } from './registries/gb-fca.js';
import { UsFincenParser } from './registries/us-fincen.js';
import { AeVaraParser } from './registries/ae-vara.js';

import { ItConsobParser } from './registries/it-consob.js';
import { EsCnmvParser } from './registries/es-cnmv.js';
import { AtFmaParser } from './registries/at-fma.js';
import { IeCbiParser } from './registries/ie-cbi.js';
import { PtCmvmParser } from './registries/pt-cmvm.js';
import { LuCssfParser } from './registries/lu-cssf.js';
import { BeFsmaParser } from './registries/be-fsma.js';
import { MtMfsaParser } from './registries/mt-mfsa.js';
import { LtBolParser } from './registries/lt-bol.js';
import { EeFsaParser } from './registries/ee-fsa.js';
import { PlKnfParser } from './registries/pl-knf.js';
import { CzCnbParser } from './registries/cz-cnb.js';
import { CyCysecParser } from './registries/cy-cysec.js';
import { SeFiParser } from './registries/se-fi.js';
import { FiFinfsaParser } from './registries/fi-finfsa.js';
import { DkDfsaParser } from './registries/dk-dfsa.js';
import { NoFsaParser } from './registries/no-fsa.js';

import { EsmaUnifiedParser } from './registries/esma-unified.js';
import { EbaEuclidParser } from './registries/eba-euclid.js';

import { ThSecParser } from './registries/th-sec.js';
import { MyScParser } from './registries/my-sc.js';
import { ScFsaParser } from './registries/sc-fsa.js';
import { GiGfscParser } from './registries/gi-gfsc.js';
import { ImFsaParser } from './registries/im-fsa.js';

import { LiFmaParser } from './registries/li-fma.js';
import { TwFscParser } from './registries/tw-fsc.js';
import { KyCimaParser } from './registries/ky-cima.js';
import { IdOjkParser } from './registries/id-ojk.js';

import { UsNydfsParser } from './registries/us-nydfs.js';
import { UsFdicParser } from './registries/us-fdic.js';
import { HkSfcParser } from './registries/hk-sfc.js';
import { BrBcbParser } from './registries/br-bcb.js';
import { NgSecParser } from './registries/ng-sec.js';
import { SvCnadParser } from './registries/sv-cnad.js';
import { KrFiuParser } from './registries/kr-fiu.js';
import { GbPraParser } from './registries/gb-pra.js';
import { PhBspParser } from './registries/ph-bsp.js';
import { ArCnvParser } from './registries/ar-cnv.js';

import { KzAfsaParser } from './registries/kz-afsa.js';
import { TrSpkParser } from './registries/tr-spk.js';
import { AeAdgmParser } from './registries/ae-adgm.js';
import { BhCbbParser } from './registries/bh-cbb.js';

import { AeDfsaParser } from './registries/ae-dfsa.js';
import { BmBmaParser } from './registries/bm-bma.js';
import { InFiuParser } from './registries/in-fiu.js';

import { MxCnbvParser } from './registries/mx-cnbv.js';
import { CoSfcParser } from './registries/co-sfc.js';
import { IlIsaParser } from './registries/il-isa.js';
import { JeJfscParser } from './registries/je-jfsc.js';
import { GgGfscParser } from './registries/gg-gfsc.js';
import { VgFscParser } from './registries/vg-fsc.js';

import { SaSamaParser } from './registries/sa-sama.js';
import { QaQfcraParser } from './registries/qa-qfcra.js';
import { PaSbpParser } from './registries/pa-sbp.js';
import { EeFiuParser } from './registries/ee-fiu.js';

import { KeCmaParser } from './registries/ke-cma.js';
import { ClCmfParser } from './registries/cl-cmf.js';
import { UaNssmcParser } from './registries/ua-nssmc.js';
import { VnSbvParser } from './registries/vn-sbv.js';
import { NgCbnParser } from './registries/ng-cbn.js';
import { HrHanfaParser } from './registries/hr-hanfa.js';

import { RuCbrParser } from './registries/ru-cbr.js';
import { GeNbgParser } from './registries/ge-nbg.js';
import { PkSecpParser } from './registries/pk-secp.js';
import { PeSbsParser } from './registries/pe-sbs.js';
import { TzBotParser } from './registries/tz-bot.js';
import { BdBsecParser } from './registries/bd-bsec.js';

export const PARSERS: Record<string, () => RegistryParser> = {
  'za-fsca': () => new ZaFscaParser(),
  'jp-fsa': () => new JpFsaParser(),
  'fr-amf': () => new FrAmfParser(),
  'de-bafin': () => new DeBafinParser(),
  'au-austrac': () => new AuAustracParser(),
  'sg-mas': () => new SgMasParser(),
  'nl-dnb': () => new NlDnbParser(),
  'ch-finma': () => new ChFinmaParser(),
  'ca-fintrac': () => new CaFintracParser(),
  'gb-fca': () => new GbFcaParser(),
  'us-fincen': () => new UsFincenParser(),
  'ae-vara': () => new AeVaraParser(),

  'it-consob': () => new ItConsobParser(),
  'es-cnmv': () => new EsCnmvParser(),
  'at-fma': () => new AtFmaParser(),
  'ie-cbi': () => new IeCbiParser(),
  'pt-cmvm': () => new PtCmvmParser(),
  'lu-cssf': () => new LuCssfParser(),
  'be-fsma': () => new BeFsmaParser(),
  'mt-mfsa': () => new MtMfsaParser(),
  'lt-bol': () => new LtBolParser(),
  'ee-fsa': () => new EeFsaParser(),
  'pl-knf': () => new PlKnfParser(),
  'cz-cnb': () => new CzCnbParser(),
  'cy-cysec': () => new CyCysecParser(),
  'se-fi': () => new SeFiParser(),
  'fi-finfsa': () => new FiFinfsaParser(),
  'dk-dfsa': () => new DkDfsaParser(),
  'no-fsa': () => new NoFsaParser(),

  'esma-unified': () => new EsmaUnifiedParser(),
  'eba-euclid': () => new EbaEuclidParser(),

  'th-sec': () => new ThSecParser(),
  'my-sc': () => new MyScParser(),
  'sc-fsa': () => new ScFsaParser(),
  'gi-gfsc': () => new GiGfscParser(),
  'im-fsa': () => new ImFsaParser(),

  'li-fma': () => new LiFmaParser(),
  'tw-fsc': () => new TwFscParser(),
  'ky-cima': () => new KyCimaParser(),
  'id-ojk': () => new IdOjkParser(),

  'us-nydfs': () => new UsNydfsParser(),
  'us-fdic': () => new UsFdicParser(),
  'hk-sfc': () => new HkSfcParser(),
  'br-bcb': () => new BrBcbParser(),
  'ng-sec': () => new NgSecParser(),
  'sv-cnad': () => new SvCnadParser(),
  'kr-fiu': () => new KrFiuParser(),
  'gb-pra': () => new GbPraParser(),
  'ph-bsp': () => new PhBspParser(),
  'ar-cnv': () => new ArCnvParser(),

  'kz-afsa': () => new KzAfsaParser(),
  'tr-spk': () => new TrSpkParser(),
  'ae-adgm': () => new AeAdgmParser(),
  'bh-cbb': () => new BhCbbParser(),

  'ae-dfsa': () => new AeDfsaParser(),
  'bm-bma': () => new BmBmaParser(),
  'in-fiu': () => new InFiuParser(),

  'mx-cnbv': () => new MxCnbvParser(),
  'co-sfc': () => new CoSfcParser(),
  'il-isa': () => new IlIsaParser(),
  'je-jfsc': () => new JeJfscParser(),
  'gg-gfsc': () => new GgGfscParser(),
  'vg-fsc': () => new VgFscParser(),

  'sa-sama': () => new SaSamaParser(),
  'qa-qfcra': () => new QaQfcraParser(),
  'pa-sbp': () => new PaSbpParser(),
  'ee-fiu': () => new EeFiuParser(),

  'ke-cma': () => new KeCmaParser(),
  'cl-cmf': () => new ClCmfParser(),
  'ua-nssmc': () => new UaNssmcParser(),
  'vn-sbv': () => new VnSbvParser(),
  'ng-cbn': () => new NgCbnParser(),
  'hr-hanfa': () => new HrHanfaParser(),

  'ru-cbr': () => new RuCbrParser(),
  'ge-nbg': () => new GeNbgParser(),
  'pk-secp': () => new PkSecpParser(),
  'pe-sbs': () => new PeSbsParser(),
  'tz-bot': () => new TzBotParser(),
  'bd-bsec': () => new BdBsecParser(),
};
