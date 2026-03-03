import { useRef, useEffect, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Plus, Minus } from 'lucide-react';
import { REGIME_COLORS, TRAVEL_RULE_MAP_COLORS } from '../../theme';
import { numericToAlpha2 } from '../../data/isoMapping';
import type { Jurisdiction, RegimeType, TravelRuleStatus } from '../../types';

export type MapColorMode = 'regime' | 'travelRule';

interface Props {
  height?: string;
  jurisdictions: Jurisdiction[];
  selectedRegimes?: RegimeType[];
  selectedTravelRules?: TravelRuleStatus[];
  onCountryClick?: (code: string) => void;
  onMiniStatClick?: (label: string) => void;
  activeMiniStat?: string | null;
  compact?: boolean;
  colorMode?: MapColorMode;
  /** Alpha-2 code — zoom map to this country on load */
  focusCountry?: string;
}

/* Build a MapLibre match expression for fill-color */
function buildFillExpression(mode: MapColorMode): maplibregl.ExpressionSpecification {
  if (mode === 'travelRule') {
    return [
      'match', ['get', 'travelRule'],
      'Enforced', TRAVEL_RULE_MAP_COLORS['Enforced'],
      'Legislated', TRAVEL_RULE_MAP_COLORS['Legislated'],
      'In Progress', TRAVEL_RULE_MAP_COLORS['In Progress'],
      'Not Implemented', TRAVEL_RULE_MAP_COLORS['Not Implemented'],
      TRAVEL_RULE_MAP_COLORS['N/A'],
    ];
  }
  return [
    'match', ['get', 'regime'],
    'Licensing', REGIME_COLORS.Licensing,
    'Registration', REGIME_COLORS.Registration,
    'Sandbox', REGIME_COLORS.Sandbox,
    'Ban', REGIME_COLORS.Ban,
    'Unclear', REGIME_COLORS.Unclear,
    REGIME_COLORS.None,
  ];
}

export default function WorldMap({
  height,
  jurisdictions,
  selectedRegimes = [],
  selectedTravelRules = [],
  onCountryClick,
  onMiniStatClick,
  activeMiniStat = null,
  compact = false,
  colorMode = 'regime',
  focusCountry,
}: Props) {
  const mapHeight = height ?? (compact ? '360px' : '65vh');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<GeoJSON.Feature[]>([]);
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

  // Dynamic mini-stats based on colorMode
  const miniStats = useMemo(() => {
    if (colorMode === 'travelRule') {
      return [
        { value: jurisdictions.filter((j) => j.travelRule === 'Enforced').length, label: 'enforced' },
        { value: jurisdictions.filter((j) => j.travelRule === 'Legislated').length, label: 'legislated' },
        { value: jurisdictions.filter((j) => j.travelRule === 'In Progress').length, label: 'in progress' },
      ];
    }
    const noneUnclear = jurisdictions.filter((j) => j.regime === 'None' || j.regime === 'Unclear').length;
    return [
      { value: jurisdictions.filter((j) => j.regime === 'Licensing').length, label: 'licensing' },
      { value: jurisdictions.filter((j) => j.regime === 'Registration').length, label: 'registration' },
      { value: jurisdictions.filter((j) => j.regime === 'Sandbox').length, label: 'sandbox' },
      { value: jurisdictions.filter((j) => j.regime === 'Ban').length, label: 'ban' },
      { value: noneUnclear, label: 'none / unclear' },
    ];
  }, [jurisdictions, colorMode]);

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

    // Disable scroll zoom — user requested explicit zoom buttons only
    map.scrollZoom.disable();

    mapRef.current = map;

    map.on('load', async () => {
      const resp = await fetch(`${import.meta.env.BASE_URL}countries-110m.json`);
      const topo = (await resp.json()) as Topology;
      const geo = topojson.feature(topo, topo.objects.countries as GeometryCollection);

      const fixAntimeridian = (feature: (typeof geo.features)[0]) => {
        if (feature.geometry.type !== 'MultiPolygon') return feature;
        const coords = feature.geometry.coordinates as number[][][][];
        const fixed = coords.filter((polygon) => {
          const ring = polygon[0];
          const lngs = ring.map((pt) => pt[0]);
          const span = Math.max(...lngs) - Math.min(...lngs);
          return span < 300;
        });
        if (fixed.length === 0) return feature;
        return { ...feature, geometry: { ...feature.geometry, type: 'MultiPolygon' as const, coordinates: fixed } };
      };

      const features = geo.features
        .filter((f) => String(f.id ?? '') !== '010')
        .map(fixAntimeridian)
        .map((f) => {
          const numId = String(f.id ?? '');
          const alpha2 = numericToAlpha2[numId] ?? '';
          if (!alpha2 && import.meta.env.DEV) {
            console.warn(`[WorldMap] Unmapped TopoJSON feature id=${numId}`);
          }
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

      featuresRef.current = features as unknown as GeoJSON.Feature[];

      map.addSource('countries', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      });

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': buildFillExpression(colorMode) as unknown as string,
          'fill-opacity': 0.82,
        },
      });

      map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': '#E2E8F0', 'line-width': 0.6 },
      });

      map.addLayer({
        id: 'countries-hover',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': '#0A2540', 'fill-opacity': 0 },
      });

      setLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update fill color when colorMode changes
  useEffect(() => {
    if (!loaded || !mapRef.current) return;
    mapRef.current.setPaintProperty(
      'countries-fill',
      'fill-color',
      buildFillExpression(colorMode) as unknown as string,
    );
  }, [loaded, colorMode]);

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

  // Zoom to focused country (for detail page mini-map)
  useEffect(() => {
    if (!loaded || !mapRef.current || !focusCountry) return;
    const features = featuresRef.current as Array<{ properties?: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }>;
    const target = features.find((f) => f.properties?.alpha2 === focusCountry.toUpperCase());
    if (!target) return;

    const bounds = new maplibregl.LngLatBounds();
    const processCoords = (coords: unknown): void => {
      if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number') {
        bounds.extend(coords as [number, number]);
      } else if (Array.isArray(coords)) {
        coords.forEach(processCoords);
      }
    };
    processCoords(target.geometry.coordinates);
    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 4, duration: 0 });
    }
  }, [loaded, focusCountry]);

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
          const travelRule = f.properties?.travelRule || '';
          const entities = f.properties?.entityCount || 0;
          const regulator = f.properties?.regulator || '';
          tooltip.innerHTML = `
            <strong>${name}</strong>
            <div style="margin-top:4px;font-size:0.75rem;color:var(--text-muted)">
              ${regime} · ${travelRule}
              <br/>${entities} entities
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

  const handleZoomIn = (e: React.MouseEvent) => { e.stopPropagation(); mapRef.current?.zoomIn(); };
  const handleZoomOut = (e: React.MouseEvent) => { e.stopPropagation(); mapRef.current?.zoomOut(); };

  // Choose legend colors based on mode
  const legendColors = colorMode === 'travelRule' ? TRAVEL_RULE_MAP_COLORS : REGIME_COLORS;
  const legendTitle = colorMode === 'travelRule' ? 'Travel Rule Status' : 'Regulatory Regime';

  // Tooltip descriptions for each legend item
  const legendTooltips: Record<string, string> = {
    Licensing: 'A formal license is required to operate as a VASP. Comprehensive regulatory requirements with ongoing supervision.',
    Registration: 'Notification-based registration required. Less stringent than a full license but still regulated.',
    Sandbox: 'Regulatory sandbox available for crypto firms to operate under controlled, experimental conditions.',
    Ban: 'Crypto-related activities are prohibited by the government.',
    None: 'No specific crypto or VASP regulatory framework in place.',
    Unclear: 'Regulatory status is ambiguous, under development, or not yet clearly defined.',
    Enforced: 'FATF Travel Rule is actively enforced by regulators. VASPs must share originator/beneficiary data.',
    Legislated: 'Travel Rule has been passed into law, but active enforcement may still be developing.',
    'In Progress': 'The jurisdiction is working on implementing Travel Rule requirements.',
    'Not Implemented': 'No Travel Rule requirements currently in place.',
    'N/A': 'Travel Rule status is not applicable or not tracked for this jurisdiction.',
  };

  return (
    <div style={{ position: 'relative', height: mapHeight, minHeight: compact ? 200 : 300 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div ref={tooltipRef} className="st-map-tooltip" />

      {/* Zoom Controls */}
      <div className="st-map-zoom-controls">
        <button onClick={handleZoomIn} aria-label="Zoom in" className="st-map-zoom-btn">
          <Plus size={16} />
        </button>
        <button onClick={handleZoomOut} aria-label="Zoom out" className="st-map-zoom-btn">
          <Minus size={16} />
        </button>
      </div>

      {/* Legend */}
      {!compact && (
        <div className="st-map-legend">
          <div className="st-map-legend-title">{legendTitle}</div>
          {Object.entries(legendColors).map(([label, color]) => (
            <div
              key={label}
              className="st-map-legend-item"
              title={legendTooltips[label] ?? ''}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, flexShrink: 0 }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Mini-Stats Overlay — clickable toggle filters */}
      {!compact && (
        <div className="st-map-mini-stats">
          {miniStats.map((s) => (
            <button
              key={s.label}
              className={`st-map-mini-stat${activeMiniStat === s.label ? ' active' : ''}`}
              onClick={() => onMiniStatClick?.(s.label)}
              type="button"
            >
              <span className="st-map-mini-stat-value">{s.value}</span>
              <span className="st-map-mini-stat-label">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
