import { useRef, useEffect, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { REGIME_COLORS } from '../../theme';
import { numericToAlpha2 } from '../../data/isoMapping';
import type { Jurisdiction, RegimeType, TravelRuleStatus } from '../../types';

interface Props {
  height?: string;
  jurisdictions: Jurisdiction[];
  selectedRegimes?: RegimeType[];
  selectedTravelRules?: TravelRuleStatus[];
  onCountryClick?: (code: string) => void;
  compact?: boolean;
}

export default function WorldMap({
  height,
  jurisdictions,
  selectedRegimes = [],
  selectedTravelRules = [],
  onCountryClick,
  compact = false,
}: Props) {
  const mapHeight = height ?? (compact ? '360px' : '65vh');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Build lookup: alpha2 → jurisdiction
  const jurisdictionMap = useMemo(() => {
    const m = new Map<string, (typeof jurisdictions)[0]>();
    jurisdictions.forEach((j) => m.set(j.code.toUpperCase(), j));
    return m;
  }, [jurisdictions]);

  // Active country codes based on filter state
  const activeCodes = useMemo(() => {
    let filtered = jurisdictions;
    if (selectedRegimes.length) filtered = filtered.filter((j) => selectedRegimes.includes(j.regime));
    if (selectedTravelRules.length) filtered = filtered.filter((j) => selectedTravelRules.includes(j.travelRule));
    return new Set(filtered.map((j) => j.code.toUpperCase()));
  }, [jurisdictions, selectedRegimes, selectedTravelRules]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#F6F9FC' },
        }],
      },
      center: [20, 20],
      zoom: 1.3,
      minZoom: 1,
      maxZoom: 6,
      attributionControl: false,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    map.on('load', async () => {
      // Load TopoJSON and convert to GeoJSON
      const resp = await fetch(`${import.meta.env.BASE_URL}countries-110m.json`);
      const topo = (await resp.json()) as Topology;
      const geo = topojson.feature(topo, topo.objects.countries as GeometryCollection);

      // Fix antimeridian-crossing polygons (Russia id=643, Fiji id=242)
      // by filtering out sub-polygons whose ring spans > 300° longitude
      const fixAntimeridian = (feature: (typeof geo.features)[0]) => {
        if (feature.geometry.type !== 'MultiPolygon') return feature;
        const coords = feature.geometry.coordinates as number[][][][];
        const fixed = coords.filter((polygon) => {
          const ring = polygon[0]; // outer ring
          const lngs = ring.map((pt) => pt[0]);
          const span = Math.max(...lngs) - Math.min(...lngs);
          return span < 300; // keep normal polygons, drop world-wrapping ones
        });
        if (fixed.length === 0) return feature; // safety: don't drop entire country
        return { ...feature, geometry: { ...feature.geometry, type: 'MultiPolygon' as const, coordinates: fixed } };
      };

      // Enrich features with our data — filter out Antarctica (010)
      const features = geo.features
        .filter((f) => String(f.id ?? '') !== '010')
        .map(fixAntimeridian)
        .map((f) => {
          const numId = String(f.id ?? '');
          const alpha2 = numericToAlpha2[numId] ?? '';
          const j = jurisdictionMap.get(alpha2);
          return {
            ...f,
            properties: {
              ...f.properties,
              alpha2,
              regime: j?.regime ?? 'None',
              travelRule: j?.travelRule ?? 'N/A',
              entityCount: j?.entityCount ?? 0,
              regulator: j?.regulator ?? '',
              countryName: j?.name ?? (f.properties as Record<string, string>)?.name ?? '',
            },
          };
        });

      map.addSource('countries', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      // Country fill — muted Stripe palette
      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': [
            'match', ['get', 'regime'],
            'Licensing', REGIME_COLORS.Licensing,
            'Registration', REGIME_COLORS.Registration,
            'Sandbox', REGIME_COLORS.Sandbox,
            'Ban', REGIME_COLORS.Ban,
            'Unclear', REGIME_COLORS.Unclear,
            REGIME_COLORS.None,
          ],
          'fill-opacity': 0.82,
        },
      });

      // Country borders — subtle, not white
      map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': '#E2E8F0',
          'line-width': 0.6,
        },
      });

      // Hover highlight
      map.addLayer({
        id: 'countries-hover',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': '#0A2540',
          'fill-opacity': 0,
        },
      });

      setLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update opacity based on filter state
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    const hasFilter = selectedRegimes.length > 0 || selectedTravelRules.length > 0;

    if (!hasFilter) {
      map.setPaintProperty('countries-fill', 'fill-opacity', 0.82);
      return;
    }

    map.setPaintProperty('countries-fill', 'fill-opacity', [
      'case',
      ['in', ['get', 'alpha2'], ['literal', [...activeCodes]]],
      0.9,
      0.12,
    ]);
  }, [loaded, activeCodes, selectedRegimes, selectedTravelRules]);

  // Hover + click handlers
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    const map = mapRef.current;
    const tooltip = tooltipRef.current;
    let hoveredId: string | null = null;

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['countries-fill'] });
      if (features.length > 0) {
        const f = features[0];
        const alpha2 = f.properties?.alpha2;
        map.getCanvas().style.cursor = 'pointer';

        if (tooltip && alpha2 !== hoveredId) {
          hoveredId = alpha2;
          const name = f.properties?.countryName || '';
          const regime = f.properties?.regime || '';
          const entities = f.properties?.entityCount || 0;
          const regulator = f.properties?.regulator || '';
          tooltip.innerHTML = `
            <strong>${name}</strong>
            <div style="margin-top:4px;font-size:0.75rem;color:var(--text-muted)">
              ${regime} · ${entities} entities
              ${regulator ? `<br/>${regulator}` : ''}
            </div>
          `;
        }

        if (tooltip) {
          tooltip.classList.add('visible');
          tooltip.style.left = `${e.point.x + 12}px`;
          tooltip.style.top = `${e.point.y - 12}px`;
        }

        map.setPaintProperty('countries-hover', 'fill-opacity', [
          'case',
          ['==', ['get', 'alpha2'], alpha2],
          0.1,
          0,
        ]);
      } else {
        map.getCanvas().style.cursor = '';
        if (tooltip) tooltip.classList.remove('visible');
        hoveredId = null;
        map.setPaintProperty('countries-hover', 'fill-opacity', 0);
      }
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (tooltip) tooltip.classList.remove('visible');
      hoveredId = null;
      map.setPaintProperty('countries-hover', 'fill-opacity', 0);
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['countries-fill'] });
      if (features.length && onCountryClick) {
        const alpha2 = features[0].properties?.alpha2;
        if (alpha2) onCountryClick(alpha2);
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('mouseleave', 'countries-fill', onMouseLeave);
    map.on('click', onClick);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mouseleave', 'countries-fill', onMouseLeave);
      map.off('click', onClick);
    };
  }, [loaded, onCountryClick]);

  return (
    <div style={{ position: 'relative', height: mapHeight, minHeight: compact ? 200 : 300 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div ref={tooltipRef} className="st-map-tooltip" />
      {/* Legend */}
      {!compact && (
        <div style={{
          position: 'absolute',
          top: 56,
          right: 12,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: '0.6875rem',
          fontFamily: 'var(--font1)',
          fontWeight: 500,
          lineHeight: 1,
          boxShadow: '0 1px 3px rgba(10,37,64,0.06), 0 4px 12px rgba(10,37,64,0.04)',
          border: '1px solid rgba(10,37,64,0.06)',
          zIndex: 2,
          letterSpacing: '0.01em',
          color: '#586B82',
        }}>
          {Object.entries(REGIME_COLORS).map(([label, color]) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
