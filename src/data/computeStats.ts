import type { Entity, Jurisdiction } from '../types';

function countBy<T>(items: T[], fn: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = fn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function countByMulti<T>(items: T[], fn: (item: T) => string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const key of fn(item)) {
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function topN(counts: Record<string, number>, n: number): Array<{ name: string; count: number }> {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

export function computeStats(entities: Entity[], jurisdictions: Jurisdiction[]) {
  const activeJurisdictions = jurisdictions.filter((j) => j.entityCount > 0);

  return {
    totalEntities: entities.length,
    totalCountries: jurisdictions.length,
    activeJurisdictions: activeJurisdictions.length,
    licensingRegimes: jurisdictions.filter((j) => j.regime === 'Licensing').length,
    travelRuleEnforced: jurisdictions.filter((j) => j.travelRule === 'Enforced').length,
    byStatus: countBy(entities, (e) => e.status),
    byRegime: countBy(jurisdictions, (j) => j.regime),
    byTravelRule: countBy(jurisdictions, (j) => j.travelRule),
    byEntityType: countByMulti(entities, (e) =>
      e.entityTypes.length > 0 ? e.entityTypes : e.activities.length > 0 ? e.activities : ['Unknown'],
    ),
    byCountry: countBy(entities, (e) => e.country),
    topCountries: topN(countBy(entities, (e) => e.country), 15),
  };
}
