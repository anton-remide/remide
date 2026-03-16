# Parser Usefulness Framework (for Target Audience)

## Goal

Maximize business usefulness of parser/enrichment output for two core audiences:
- B2C market users (retail-focused due diligence and competitor scan)
- B2B users (institutional, merchant, API, compliance/vendor selection)

The parser must prioritize fields that improve decisions, not just data volume.

## What "Useful" Means

A record is useful when it helps answer at least one decision question quickly:
- Can this company serve my region?
- Is it consumer-facing or business-facing?
- Can users deposit/withdraw fiat?
- Which platforms are available (web/mobile/desktop)?
- How deep is liquidity/market offering (trading pairs)?
- How mature is the company (time on market)?

If these questions remain unanswered, data may be "present" but not actionable.

## Decision-Grade Field Set (V1)

Mandatory extraction targets from website content:
- `target_regions` (array): `global`, `US`, `EU`, `UK`, `APAC`, `MENA`, etc.
- `target_audience` (array): `consumer`, `business`, `unknown`
- `fiat_onramp` (bool|null): explicit fiat support signal
- `app_platforms` (array): `web`, `mobile`, `desktop`
- `trading_pairs` (number|null): max detected count from claims like "350+ pairs"
- `founded_year` / `years_on_market` (number|null)
- `site_languages` (array): language tags for UI transparency
- `site_business_summary_en` (text): 1-2 paragraph decision brief in English

## Parser Utility Score (PUS)

Use one score per entity and one aggregate per parser.

Per-entity score (0-100):
- Coverage (40): how many mandatory fields are present
- Confidence (30): signal quality (explicit statement > weak heuristic)
- Freshness (15): recency of enrichment and DNS/HTTP liveness
- Consistency (15): no contradictions across extracted fields

Suggested formula:
- `PUS = coverage*0.4 + confidence*0.3 + freshness*0.15 + consistency*0.15`

Parser-level quality:
- `Parser PUS = median(entity PUS) + p25(entity PUS)*0.3`
- Why: protects from "average looks good, long tail is bad"

## Confidence Rubric (Simple)

Per field confidence levels:
- High (1.0): explicit statement in site content/metadata ("Supports bank transfer")
- Medium (0.6): strong keyword pattern with context ("Deposit USD via card")
- Low (0.3): weak inference only
- Null (0.0): missing

Field confidence should be stored in `raw_data` when possible:
- `field_confidence.target_regions`, `field_confidence.fiat_onramp`, etc.

## Process (HWF Compact for Tier-2 parser improvements)

Use this cycle for each parser family:
1. Select 20 entities from one parser/source
2. Run enrichment extraction
3. Score with PUS
4. Manual review of worst 5 entities
5. Patch heuristics and rerun same sample
6. Promote changes only if median and p25 improve

Stop criteria:
- Median PUS >= 75 and p25 >= 55 on validation sample

## Business Segmentation Rules

Use extracted fields to drive product filters and enrichment priorities:
- B2C-first list: `target_audience` includes `consumer`
- B2B-first list: `target_audience` includes `business`
- Fiat-ready list: `fiat_onramp = true`
- Mobile-growth list: `app_platforms` includes `mobile`
- Mature players: `years_on_market >= 3`

Priority for paid-value surfaces:
- Top priority: entities with `fiat_onramp=true` and known region
- Medium priority: strong audience/platform signals but no fiat info
- Low priority: unknown audience + unknown region + no maturity signals

## Anti-Patterns

- Chasing rare fields before mandatory field completeness
- Counting parsed records instead of decision-grade completeness
- Treating dead DNS as automatic garbage without business review
- Keeping low-confidence inferred values without confidence tagging

## Next Execution Steps

1. Add `field_confidence` map into enrichment `raw_data`
2. Add script to compute PUS distribution by parser (`median`, `p25`, `null-rate`)
3. Add dashboard slice: B2C/B2B/fiat/mobile maturity filters
4. Validate on 2 batches (10 + 50 entities) before mass enrichment
