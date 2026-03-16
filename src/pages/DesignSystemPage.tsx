import { useState } from 'react';
import { useTheme, THEMES } from '../context/ThemeProvider';
import type { Theme } from '../context/ThemeProvider';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Heading from '../components/ui/Heading';
import Text from '../components/ui/Text';
import Divider from '../components/ui/Divider';
import Chip from '../components/ui/Chip';
import Spinner from '../components/ui/Spinner';
import Toggle from '../components/ui/Toggle';
import StatCard from '../components/ui/StatCard';
import Accordion, { AccordionItem } from '../components/ui/Accordion';
import ContentCard from '../components/ui/ContentCard';
import SearchBar from '../components/ui/SearchBar';
import FormField from '../components/ui/FormField';
import InfoRow from '../components/ui/InfoRow';
import CTABlock from '../components/ui/CTABlock';
import PullQuote from '../components/ui/PullQuote';
import SectionHeader from '../components/ui/SectionHeader';
import FilterChipGroup from '../components/ui/FilterChipGroup';
import TestimonialCard from '../components/ui/TestimonialCard';
import AuthorCard from '../components/ui/AuthorCard';
import ImageHeader from '../components/ui/ImageHeader';
import BulletItem from '../components/ui/BulletItem';
import { IconInsight, IconCheck, IconCheckbox, IconCheckboxEmpty, IconWarning, IconInfo, IconStar, IconArrowRight, IconFlag, IconTarget } from '../components/ui/BulletIcons';
import PhaseCard from '../components/ui/PhaseCard';
import SidebarNav from '../components/ui/SidebarNav';
import ContentCardGrid from '../components/ui/ContentCardGrid';
import StepFlow from '../components/ui/StepFlow';
import ProseBlock from '../components/ui/ProseBlock';
import Timeline from '../components/ui/Timeline';
import BigStatRow from '../components/ui/BigStatRow';
import Callout, { CalloutStatGrid, CalloutStat } from '../components/ui/Callout';
import MermaidDiagram from '../components/ui/MermaidDiagram';
import FlowDiagram from '../components/ui/FlowDiagram';
import SegmentedControl from '../components/ui/SegmentedControl';
import Breadcrumb from '../components/ui/Breadcrumb';
import LogoBar from '../components/ui/LogoBar';
import NavItem from '../components/ui/NavItem';
import DataTable from '../components/ui/DataTable';
import type { SortConfig } from '../types';

const THEME_LABELS: Record<Theme, string> = {
  beige: 'Beige (Light)',
  darkgray: 'Dark Gray',
  nearblack: 'Near Black',
};

const COLOR_TOKENS = [
  { token: '--color-bg', label: 'Background' },
  { token: '--color-surface', label: 'Surface' },
  { token: '--color-surface-raised', label: 'Surface Raised' },
  { token: '--color-text-main', label: 'Text Main' },
  { token: '--color-text-secondary', label: 'Text Secondary' },
  { token: '--color-border', label: 'Border' },
  { token: '--color-border-strong', label: 'Border Strong' },
  { token: '--color-accent', label: 'Accent' },
  { token: '--color-accent-hover', label: 'Accent Hover' },
  { token: '--color-accent-subtle', label: 'Accent Subtle' },
];

const SEMANTIC_TOKENS = [
  { token: '--color-success', label: 'Success' },
  { token: '--color-success-subtle', label: 'Success Subtle' },
  { token: '--color-warning', label: 'Warning' },
  { token: '--color-warning-subtle', label: 'Warning Subtle' },
  { token: '--color-danger', label: 'Danger' },
  { token: '--color-danger-subtle', label: 'Danger Subtle' },
  { token: '--color-info', label: 'Info' },
  { token: '--color-info-subtle', label: 'Info Subtle' },
  { token: '--color-neutral', label: 'Neutral' },
  { token: '--color-neutral-subtle', label: 'Neutral Subtle' },
];

const TYPE_SCALE = [
  { token: '--type-display', label: 'Display', sample: 'Aa', font: 'var(--font2)', weight: 700 },
  { token: '--type-heading-1', label: 'Heading 1', sample: 'Aa', font: 'var(--font2)', weight: 700 },
  { token: '--type-heading-2', label: 'Heading 2', sample: 'Heading Two', font: 'var(--font1)', weight: 600 },
  { token: '--type-heading-3', label: 'Heading 3', sample: 'Heading Three', font: 'var(--font1)', weight: 600 },
  { token: '--type-body-lg', label: 'Body Large', sample: 'The quick brown fox jumps over the lazy dog.', font: 'var(--font1)', weight: 400 },
  { token: '--type-body', label: 'Body', sample: 'The quick brown fox jumps over the lazy dog.', font: 'var(--font1)', weight: 400 },
  { token: '--type-body-sm', label: 'Body Small', sample: 'The quick brown fox jumps over the lazy dog.', font: 'var(--font1)', weight: 400 },
  { token: '--type-caption', label: 'Caption', sample: 'Caption text · metadata · timestamps', font: 'var(--font1)', weight: 500 },
  { token: '--type-micro', label: 'Micro', sample: 'BADGE TEXT · TINY LABELS', font: 'var(--font1)', weight: 500 },
  { token: '--type-nano', label: 'Nano', sample: 'MINIMAL ANNOTATIONS', font: 'var(--font1)', weight: 600 },
];

const SPACING = [
  { token: '--space-0', value: '0', px: 0 },
  { token: '--space-0-5', value: '2px', px: 2 },
  { token: '--space-1', value: '4px', px: 4 },
  { token: '--space-2', value: '8px', px: 8 },
  { token: '--space-3', value: '12px', px: 12 },
  { token: '--space-4', value: '16px', px: 16 },
  { token: '--space-6', value: '24px', px: 24 },
  { token: '--space-8', value: '32px', px: 32 },
  { token: '--space-12', value: '48px', px: 48 },
  { token: '--space-16', value: '64px', px: 64 },
  { token: '--space-24', value: '96px', px: 96 },
];

const RADII = [
  { token: '--radius-0', value: '0', px: 0 },
  { token: '--radius-sm', value: '4px', px: 4 },
  { token: '--radius-md', value: '8px', px: 8 },
  { token: '--radius-lg', value: '16px', px: 16 },
  { token: '--radius-pill', value: '9999px', px: 9999 },
];

const SHADOWS = ['--shadow-none', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-focus'];

const BADGE_VARIANTS = [
  { label: 'Licensing', bg: 'var(--color-success-subtle)', color: 'var(--color-success)' },
  { label: 'Registration', bg: 'var(--color-info-subtle)', color: 'var(--color-info)' },
  { label: 'Sandbox', bg: 'var(--color-warning-subtle)', color: 'var(--color-warning)' },
  { label: 'Ban', bg: 'var(--color-danger-subtle)', color: 'var(--color-danger)' },
  { label: 'None', bg: 'var(--color-neutral-subtle)', color: 'var(--color-neutral)' },
];

function FilterChipDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['licensing']));
  return (
    <FilterChipGroup
      options={[
        { id: 'licensing', label: 'Licensing' },
        { id: 'registration', label: 'Registration' },
        { id: 'sandbox', label: 'Sandbox' },
        { id: 'ban', label: 'Ban' },
        { id: 'none', label: 'No Framework' },
      ]}
      selected={selected}
      onChange={setSelected}
    />
  );
}

function ChipDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Licensing']));
  const [chips, setChips] = useState(['Licensing', 'CBDC', 'Travel Rule', 'Stablecoin']);
  const toggle = (c: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(c) ? next.delete(c) : next.add(c);
    return next;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <Text size="sm" color="secondary" as="div" style={{ marginBottom: 8 }}>Selectable chips:</Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map(c => (
            <Chip key={c} selected={selected.has(c)} onClick={() => toggle(c)}>{c}</Chip>
          ))}
        </div>
      </div>
      <div>
        <Text size="sm" color="secondary" as="div" style={{ marginBottom: 8 }}>Removable chips:</Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chips.map(c => (
            <Chip key={c} onRemove={() => setChips(prev => prev.filter(x => x !== c))}>{c}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 64, scrollMarginTop: 'calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px) + 46px + 24px)' }}>
      <h2 style={{
        fontFamily: 'var(--font2)',
        fontSize: 'var(--type-heading-2)',
        fontWeight: 700,
        color: 'var(--color-text-main)',
        marginBottom: 24,
        paddingBottom: 12,
        borderBottom: '1px solid var(--color-border-strong)',
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
      }}>{title}</h2>
      {children}
    </section>
  );
}

function ColorSwatch({ token, label }: { token: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-md)',
        background: `var(${token})`,
        border: '1px solid var(--color-border-strong)',
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-main)' }}>
          {label}
        </div>
        <code style={{ fontSize: 'var(--type-caption)', color: 'var(--color-text-secondary)' }}>
          {token}
        </code>
      </div>
    </div>
  );
}

function SegmentedDemo() {
  const [seg, setSeg] = useState('entities');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SegmentedControl
        options={[
          { value: 'entities', label: 'Entities' },
          { value: 'stablecoins', label: 'Stablecoins' },
          { value: 'cbdcs', label: 'CBDCs' },
          { value: 'issuers', label: 'Issuers' },
        ]}
        value={seg}
        onChange={setSeg}
      />
      <p style={{ fontSize: 'var(--type-body-sm)', color: 'var(--color-text-secondary)' }}>
        Selected: <strong>{seg}</strong>
      </p>
    </div>
  );
}

const TABLE_SAMPLE = [
  { name: 'Binance', country: 'Cayman Islands', status: 'Licensed', type: 'Exchange' },
  { name: 'Coinbase', country: 'United States', status: 'Registered', type: 'Exchange' },
  { name: 'Kraken', country: 'United States', status: 'Licensed', type: 'Exchange' },
  { name: 'Circle', country: 'United States', status: 'Licensed', type: 'Issuer' },
  { name: 'Tether', country: 'BVI', status: 'Provisional', type: 'Issuer' },
  { name: 'Ripple', country: 'United States', status: 'Licensed', type: 'Payment' },
  { name: 'Stripe', country: 'United States', status: 'Registered', type: 'Payment' },
];
const TABLE_TYPES = [...new Set(TABLE_SAMPLE.map(d => d.type))];

function DataTableDemo() {
  const [sortCfg, setSortCfg] = useState<SortConfig>({ field: 'name', direction: 'asc' });
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const filtered = TABLE_SAMPLE
    .filter(d => typeFilter.length === 0 || typeFilter.includes(d.type))
    .filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const sorted = [...filtered].sort((a, b) => {
    if (!sortCfg.direction) return 0;
    const v = (a as Record<string, string>)[sortCfg.field]?.localeCompare((b as Record<string, string>)[sortCfg.field] || '') ?? 0;
    return sortCfg.direction === 'asc' ? v : -v;
  });
  return (
    <DataTable
      columns={[
        { key: 'name', label: 'Name', sortable: true },
        { key: 'country', label: 'Country', sortable: true },
        { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge variant={r.status === 'Licensed' ? 'success' : r.status === 'Registered' ? 'info' : 'warning'}>{r.status as string}</Badge> },
        {
          key: 'type', label: 'Type', sortable: true, filterable: true,
          filterValues: TABLE_TYPES,
          selectedFilters: typeFilter,
          onFilterApply: (_f, sel) => setTypeFilter(sel),
          onFilterClear: () => setTypeFilter([]),
        },
      ]}
      data={sorted}
      sort={sortCfg}
      onSort={(field) => setSortCfg(prev => ({
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' as const,
      }))}
      page={1}
      totalPages={1}
      onPageChange={() => {}}
      totalFiltered={sorted.length}
      totalCount={TABLE_SAMPLE.length}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search entities..."
    />
  );
}

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  return (
    <div
      data-density={density}
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text-main)',
        minHeight: '100vh',
        transition: 'background 300ms, color 300ms',
        paddingTop: 'calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px))',
      }}
    >
      {/* Sticky toolbar */}
      <div style={{
        position: 'sticky',
        top: 'calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px))',
        zIndex: 99,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-strong)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 32px 6px' }}>
          <span style={{
            fontFamily: 'var(--font2)',
            fontSize: 18,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}>
            RemiDe UI
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: theme === t ? 700 : 500,
                  fontFamily: 'var(--font1)',
                  background: theme === t ? 'var(--color-accent)' : 'transparent',
                  color: theme === t ? '#fff' : 'var(--color-text-secondary)',
                  border: theme === t ? 'none' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {(['comfortable', 'compact'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: density === d ? 700 : 500,
                  fontFamily: 'var(--font1)',
                  background: density === d ? 'var(--color-text-main)' : 'transparent',
                  color: density === d ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  border: density === d ? 'none' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Two-column layout: sidebar + content */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)' }}>
        {/* Sidebar */}
        <nav style={{
          width: 220,
          flexShrink: 0,
          position: 'sticky',
          top: 'calc(var(--header-current-height, 64px) + var(--top-banner-height, 0px) + 46px)',
          height: 'calc(100vh - var(--header-current-height, 64px) - var(--top-banner-height, 0px) - 46px)',
          overflowY: 'auto',
          padding: '24px 0 24px 24px',
          borderRight: '1px solid var(--color-border)',
          scrollbarWidth: 'thin',
        }}>
          {[
            { title: 'Foundation', items: [
              { id: 'colors', label: 'Colors' },
              { id: 'type', label: 'Typography' },
              { id: 'spacing', label: 'Spacing' },
              { id: 'shadows', label: 'Shadows' },
              { id: 'radii', label: 'Radii' },
            ]},
            { title: 'Atoms', items: [
              { id: 'badges', label: 'Badge' },
              { id: 'buttons', label: 'Button' },
              { id: 'inputs', label: 'Input' },
              { id: 'headings', label: 'Heading' },
              { id: 'text', label: 'Text' },
              { id: 'chips', label: 'Chip' },
              { id: 'toggles', label: 'Toggle' },
              { id: 'spinners', label: 'Spinner' },
              { id: 'dividers', label: 'Divider' },
            ]},
            { title: 'Molecules', items: [
              { id: 'statcards', label: 'StatCard' },
              { id: 'cards', label: 'Cards' },
              { id: 'contentcard', label: 'ContentCard' },
              { id: 'accordion', label: 'Accordion' },
              { id: 'searchbar', label: 'SearchBar' },
              { id: 'inforow', label: 'InfoRow' },
              { id: 'ctablock', label: 'CTABlock' },
              { id: 'pullquote', label: 'PullQuote' },
              { id: 'sectionheader', label: 'SectionHeader' },
              { id: 'filterchips', label: 'FilterChips' },
              { id: 'testimonial', label: 'Testimonial' },
              { id: 'authorcard', label: 'AuthorCard' },
              { id: 'imageheader', label: 'ImageHeader' },
              { id: 'bullets', label: 'BulletItem' },
              { id: 'phasecards', label: 'PhaseCard' },
              { id: 'callout', label: 'Callout' },
              { id: 'mermaid', label: 'Mermaid Diagrams' },
              { id: 'segmented', label: 'SegmentedControl' },
              { id: 'breadcrumb', label: 'Breadcrumb' },
              { id: 'navitem', label: 'NavItem' },
              { id: 'logobar', label: 'LogoBar' },
            ]},
            { title: 'Organisms', items: [
              { id: 'stepflow', label: 'StepFlow' },
              { id: 'timeline', label: 'Timeline' },
              { id: 'bigstats', label: 'BigStatRow' },
              { id: 'sidebarnav', label: 'SidebarNav' },
              { id: 'cardgrid', label: 'CardGrid' },
              { id: 'prose', label: 'ProseBlock' },
              { id: 'datatable', label: 'DataTable' },
            ]},
            { title: 'System', items: [
              { id: 'density', label: 'Density' },
              { id: 'unique', label: 'Unique Elements' },
            ]},
          ].map(section => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              <div style={{
                fontFamily: 'var(--font2)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-secondary)',
                padding: '0 0 6px',
                marginBottom: 2,
              }}>
                {section.title}
              </div>
              {section.items.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  style={{
                    display: 'block',
                    padding: '5px 12px',
                    fontSize: 13,
                    color: 'var(--color-text-secondary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'background-color 120ms, color 120ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-subtle)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div style={{ flex: 1, maxWidth: 960, padding: '32px 48px' }}>

          <h1 style={{
            fontFamily: 'var(--font2)',
            fontSize: 'var(--type-display)',
            fontWeight: 700,
            color: 'var(--color-text-main)',
            marginBottom: 8,
            lineHeight: 1.08,
            textTransform: 'uppercase',
            letterSpacing: '-0.03em',
          }}>
            Design System
          </h1>
        <p style={{
          fontSize: 'var(--type-body-lg)',
          color: 'var(--color-text-secondary)',
          marginBottom: 64,
          maxWidth: 600,
        }}>
          Canonical token spec, components, and composition rules for the RemiDe ecosystem.
          Switch themes and density above to preview all states.
        </p>

        {/* ── Colors ── */}
        <Section title="Colors" id="colors">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 16, color: 'var(--color-text-main)' }}>
                Core
              </h3>
              {COLOR_TOKENS.map(c => <ColorSwatch key={c.token} {...c} />)}
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 16, color: 'var(--color-text-main)' }}>
                Semantic
              </h3>
              {SEMANTIC_TOKENS.map(c => <ColorSwatch key={c.token} {...c} />)}
            </div>
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Type Scale" id="type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {TYPE_SCALE.map(t => (
              <div key={t.token} style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 24,
                paddingBottom: 16,
                borderBottom: '1px solid var(--color-border)',
              }}>
                <code style={{
                  fontSize: 'var(--type-caption)',
                  color: 'var(--color-text-secondary)',
                  width: 140,
                  flexShrink: 0,
                }}>
                  {t.label}
                </code>
                <span style={{
                  fontSize: `var(${t.token})`,
                  fontFamily: t.font,
                  fontWeight: t.weight,
                  color: 'var(--color-text-main)',
                  lineHeight: 1.2,
                }}>
                  {t.sample}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Spacing ── */}
        <Section title="Spacing (4px grid)" id="spacing">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SPACING.map(s => (
              <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <code style={{
                  fontSize: 'var(--type-caption)',
                  color: 'var(--color-text-secondary)',
                  width: 120,
                  flexShrink: 0,
                  textAlign: 'right',
                }}>
                  {s.token}
                </code>
                <div style={{
                  width: Math.min(s.px, 300) || 2,
                  height: 24,
                  background: 'var(--color-accent)',
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.7,
                }} />
                <span style={{ fontSize: 'var(--type-caption)', color: 'var(--color-text-secondary)' }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Shadows ── */}
        <Section title="Shadows" id="shadows">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
            {SHADOWS.map(s => (
              <div key={s} style={{
                background: 'var(--color-surface)',
                boxShadow: `var(${s})`,
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                textAlign: 'center',
                border: s === '--shadow-none' ? '1px solid var(--color-border)' : 'none',
              }}>
                <code style={{ fontSize: 'var(--type-micro)', color: 'var(--color-text-secondary)' }}>
                  {s.replace('--shadow-', '')}
                </code>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Radii ── */}
        <Section title="Border Radius" id="radii">
          <div style={{ display: 'flex', gap: 24, alignItems: 'end' }}>
            {RADII.map(r => (
              <div key={r.token} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 72,
                  height: 72,
                  background: 'var(--color-accent-subtle)',
                  border: '2px solid var(--color-accent)',
                  borderRadius: `var(${r.token})`,
                  marginBottom: 8,
                }} />
                <code style={{ fontSize: 'var(--type-micro)', color: 'var(--color-text-secondary)' }}>
                  {r.token.replace('--radius-', '')}
                </code>
                <div style={{ fontSize: 'var(--type-nano)', color: 'var(--color-text-secondary)' }}>
                  {r.value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Badges ── */}
        <Section title="Badges" id="badges">
          <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>
            Variant System (theme-aware)
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <Badge variant="success">Licensing</Badge>
            <Badge variant="info">Registration</Badge>
            <Badge variant="warning">Sandbox</Badge>
            <Badge variant="danger">Ban</Badge>
            <Badge variant="neutral">None</Badge>
            <Badge variant="accent">Featured</Badge>
          </div>
          <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>
            Size: Small
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            <Badge variant="success" size="sm">Licensing</Badge>
            <Badge variant="danger" size="sm">Ban</Badge>
            <Badge variant="neutral" size="sm">N/A</Badge>
          </div>
          <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>
            Legacy colorMap (backward compat)
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BADGE_VARIANTS.map(b => (
              <Badge key={b.label} label={b.label} colorMap={{
                [b.label]: { bg: b.bg, text: b.color },
              }} />
            ))}
          </div>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Buttons" id="buttons">
          <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>
            Using Button component
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
            <Button>Primary Action</Button>
            <Button variant="outline">Outline</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
            <Button icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}>
              With Icon
            </Button>
          </div>
        </Section>

        {/* ── Inputs ── */}
        <Section title="Inputs" id="inputs">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 640 }}>
            <Input label="Email" placeholder="you@example.com" type="email" />
            <Input label="Password" placeholder="Enter password" type="password" hint="At least 8 characters" />
            <Input label="Search" placeholder="Search jurisdictions..." icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            } />
            <Input label="With error" placeholder="Invalid input" error="This field is required" />
          </div>
        </Section>

        {/* ── Headings ── */}
        <Section title="Headings" id="headings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Heading level={1} display>Display Heading</Heading>
            <Heading level={1}>Heading 1</Heading>
            <Heading level={2}>Heading 2</Heading>
            <Heading level={3}>Heading 3</Heading>
            <Heading level={4}>Heading 4</Heading>
            <Heading level={5}>Heading 5</Heading>
            <Heading level={6}>Heading 6 (Uppercase)</Heading>
          </div>
        </Section>

        {/* ── Text ── */}
        <Section title="Text" id="text">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
            <Text size="lg">Large body text for introductions and callouts.</Text>
            <Text>Default body text for general content and paragraphs.</Text>
            <Text size="sm">Small text for compact interfaces and table cells.</Text>
            <Text size="caption" color="secondary">Caption: metadata, timestamps, labels</Text>
            <Text size="micro" color="secondary">Micro: badge text, tiny labels</Text>
            <Divider />
            <Text color="accent">Accent color text</Text>
            <Text color="success">Success status message</Text>
            <Text color="danger">Error or danger text</Text>
            <Text color="warning">Warning notification</Text>
            <Text color="info">Informational text</Text>
          </div>
        </Section>

        {/* ── Chips ── */}
        <Section title="Chips" id="chips">
          <ChipDemo />
        </Section>

        {/* ── Toggles ── */}
        <Section title="Toggles" id="toggles">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Toggle label="Email notifications" defaultChecked />
            <Toggle label="Dark mode" />
            <Toggle label="Compact toggle" size="sm" />
          </div>
        </Section>

        {/* ── Spinners ── */}
        <Section title="Spinners" id="spinners">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <Spinner size={16} />
              <Text size="caption" color="secondary" as="div">16px</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Spinner size={20} />
              <Text size="caption" color="secondary" as="div">20px</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Spinner size={32} />
              <Text size="caption" color="secondary" as="div">32px</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Spinner size={48} />
              <Text size="caption" color="secondary" as="div">48px</Text>
            </div>
          </div>
        </Section>

        {/* ── Dividers ── */}
        <Section title="Dividers" id="dividers">
          <div style={{ maxWidth: 400 }}>
            <Text size="sm" color="secondary">Simple divider:</Text>
            <Divider />
            <Text size="sm" color="secondary">Labeled divider:</Text>
            <Divider label="OR" />
            <Text size="sm" color="secondary">Another label:</Text>
            <Divider label="Section Break" />
          </div>
        </Section>

        {/* ── ContentCard ── */}
        <Section title="Content Card" id="contentcard">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <ContentCard
              title="Africa's $120B Crisis"
              description="How regulatory fragmentation is costing African economies billions in illicit flows."
              badge={<Badge variant="danger" size="sm">Research</Badge>}
              to="#"
              meta="Jan 2026 · 12 min read"
            />
            <ContentCard
              title="Stablecoin Regulation"
              description="Global stablecoin frameworks compared: EU MiCA, US GENIUS Act, Singapore PSA."
              badge={<Badge variant="info" size="sm">Analysis</Badge>}
              to="#"
              meta="Feb 2026 · 8 min read"
            />
            <ContentCard
              title="CBDC Tracker Update"
              description="134 central bank digital currencies tracked across research, pilot, and launch stages."
              badge={<Badge variant="success" size="sm">Data</Badge>}
              to="#"
              meta="Updated weekly"
            />
          </div>
        </Section>

        {/* ── StatCard ── */}
        <Section title="Stat Cards" id="statcards">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <StatCard value="164" label="Jurisdictions" />
            <StatCard value="2,400+" label="Licensed VASPs" />
            <StatCard value="38" label="Stablecoins" />
            <StatCard value="134" label="CBDCs Tracked" />
          </div>
        </Section>

        {/* ── Cards ── */}
        <Section title="Cards" id="cards">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="st-card">
              <h4 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 8 }}>Card Title</h4>
              <p style={{ fontSize: 'var(--type-body)', color: 'var(--color-text-secondary)' }}>
                Standard card with hover elevation. Uses st-card class.
              </p>
            </div>
            <div style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
            }}>
              <h4 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 8 }}>Raised Surface</h4>
              <p style={{ fontSize: 'var(--type-body)', color: 'var(--color-text-secondary)' }}>
                Uses --color-surface-raised for layered depth.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Accordion ── */}
        <Section title="Accordion" id="accordion">
          <Accordion>
            <AccordionItem title="What is RemiDe?" defaultOpen>
              <p>RemiDe is the world's first regulatory intelligence platform for digital assets,
                tracking licensing regimes, travel rule implementation, stablecoin frameworks,
                and CBDC development across 164+ jurisdictions.</p>
            </AccordionItem>
            <AccordionItem
              title="How often is data updated?"
              badge={<Badge variant="accent" size="sm">New</Badge>}
            >
              <p>Our parsing infrastructure runs daily across 40+ regulatory registries.
                Jurisdiction profiles are verified monthly by analysts.</p>
            </AccordionItem>
            <AccordionItem title="Which jurisdictions are covered?">
              <p>We cover all G20 nations, EU member states, major financial centers,
                and emerging markets across Africa, Southeast Asia, and Latin America.</p>
            </AccordionItem>
          </Accordion>
        </Section>

        {/* ── SearchBar ── */}
        <Section title="Search Bar" id="searchbar">
          <div style={{ maxWidth: 480 }}>
            <SearchBar placeholder="Search jurisdictions, entities, reports..." />
          </div>
        </Section>

        {/* ── InfoRow ── */}
        <Section title="Info Row" id="inforow">
          <div style={{ maxWidth: 480, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0 var(--space-4)' }}>
            <InfoRow label="Country" value="Switzerland" />
            <InfoRow label="Framework" value={<Badge variant="success" size="sm">Licensing</Badge>} />
            <InfoRow label="Travel Rule" value="Implemented" />
            <InfoRow label="Last Updated" value="Mar 2026" />
          </div>
        </Section>

        {/* ── CTA Block ── */}
        <Section title="CTA Block" id="ctablock">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CTABlock
              title="Get full access"
              description="Unlock all 164 jurisdiction profiles, entity data, and weekly intelligence reports."
            >
              <Button>Subscribe Now</Button>
            </CTABlock>
            <CTABlock
              title="Early access available"
              description="Join 200+ compliance teams already tracking regulatory changes."
              variant="accent"
            >
              <Button variant="outline">Learn More</Button>
            </CTABlock>
          </div>
        </Section>

        {/* ── PullQuote ── */}
        <Section title="Pull Quote" id="pullquote">
          <PullQuote citation="World Bank, Global Financial Inclusion Report 2025">
            Regulatory fragmentation across Africa's 54 jurisdictions has created a compliance burden
            that costs the continent an estimated $120 billion annually in illicit financial flows.
          </PullQuote>
        </Section>

        {/* ── SectionHeader ── */}
        <Section title="Section Header" id="sectionheader">
          <SectionHeader
            title="Jurisdictions"
            subtitle="Track regulatory frameworks across 164+ countries"
            badge={<Badge variant="accent" size="sm">Live</Badge>}
            action={<Button variant="outline" size="sm">View All</Button>}
          />
          <SectionHeader
            title="Recent Reports"
            subtitle="Deep-dive analysis from the RemiDe Institute"
          />
        </Section>

        {/* ── FilterChipGroup ── */}
        <Section title="Filter Chip Group" id="filterchips">
          <FilterChipDemo />
        </Section>

        {/* ── TestimonialCard ── */}
        <Section title="Testimonial Card" id="testimonial">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <TestimonialCard
              quote="RemiDe has fundamentally changed how we approach regulatory due diligence across emerging markets."
              authorName="Sarah Chen"
              authorRole="Head of Compliance, Ripple"
              linkedIn="https://linkedin.com/in/example"
            />
            <TestimonialCard
              quote="The depth of coverage on African and Southeast Asian jurisdictions is unmatched in the industry."
              authorName="Marcus Wright"
              authorRole="VP Legal, Circle"
            />
          </div>
        </Section>

        {/* ── AuthorCard ── */}
        <Section title="Author Card" id="authorcard">
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Landscape</h4>
              <AuthorCard
                layout="landscape"
                name="Anton Titov"
                role="Founder, RemiDe"
                bio="Building regulatory intelligence infrastructure for digital assets across 164+ jurisdictions."
                avatar={`${import.meta.env.BASE_URL}anton-titov.png`}
              />
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portrait</h4>
              <AuthorCard
                layout="portrait"
                name="Anton Titov"
                role="Founder, RemiDe"
                bio="Building regulatory intelligence infrastructure for digital assets across 164+ jurisdictions."
                avatar={`${import.meta.env.BASE_URL}anton-titov.png`}
              />
            </div>
          </div>
        </Section>

        {/* ── ImageHeader ── */}
        <Section title="Image Header" id="imageheader">
          <ImageHeader
            title="Africa's $120 Billion Crisis"
            subtitle="How regulatory fragmentation costs the continent — and what digital assets can do about it"
            badge={<Badge variant="danger" size="sm">Research Report</Badge>}
          />
        </Section>

        {/* ── BulletItem ── */}
        <Section title="Bullet Items" id="bullets">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 48px', maxWidth: 800 }}>
            <div>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Findings (Insight)</h4>
              <BulletItem icon={<IconInsight />}>Only 38% of jurisdictions have dedicated crypto licensing</BulletItem>
              <BulletItem icon={<IconInsight />}>Travel Rule implementation varies significantly across regions</BulletItem>
              <BulletItem icon={<IconInsight />}>CBDC development accelerating with 134 projects globally</BulletItem>
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed (Checkmarks)</h4>
              <BulletItem icon={<IconCheck />} variant="success">MiCA regulation adopted across EU member states</BulletItem>
              <BulletItem icon={<IconCheck />} variant="success">FATF Travel Rule guidance finalized</BulletItem>
              <BulletItem icon={<IconCheck />} variant="success">Singapore Payment Services Act updated</BulletItem>
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Checklist (Tasks)</h4>
              <BulletItem icon={<IconCheckbox />} variant="success">Data collection from 164 jurisdictions</BulletItem>
              <BulletItem icon={<IconCheckbox />} variant="success">Regulatory framework classification</BulletItem>
              <BulletItem icon={<IconCheckboxEmpty />} variant="muted">Cross-border enforcement mapping</BulletItem>
              <BulletItem icon={<IconCheckboxEmpty />} variant="muted">Compliance cost analysis</BulletItem>
            </div>
            <div>
              <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Other Icons</h4>
              <BulletItem icon={<IconWarning />} variant="warning">Risk: grey-list exposure for non-compliant VASPs</BulletItem>
              <BulletItem icon={<IconInfo />} variant="info">MiCA creates first harmonized digital asset framework</BulletItem>
              <BulletItem icon={<IconFlag />} variant="danger">12 jurisdictions moved to active enforcement</BulletItem>
              <BulletItem icon={<IconStar />}>Ranked #1 regulatory intelligence platform for fintech</BulletItem>
              <BulletItem icon={<IconTarget />}>Goal: 200 jurisdictions covered by Q4 2026</BulletItem>
              <BulletItem icon={<IconArrowRight />} variant="muted">Next: Cross-border compliance scoring</BulletItem>
            </div>
          </div>
          <div style={{ maxWidth: 480, marginTop: 32 }}>
            <h4 style={{ fontSize: 'var(--type-body-sm)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Numbered</h4>
            <BulletItem number={1}>Real-time regulatory monitoring across 164+ countries</BulletItem>
            <BulletItem number={2}>Licensed entity database with compliance status</BulletItem>
            <BulletItem number={3}>CBDC development tracker from research to launch</BulletItem>
            <BulletItem>Default bullet style without a number or icon</BulletItem>
          </div>
        </Section>

        {/* ── PhaseCard ── */}
        <Section title="Phase Cards" id="phasecards">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <PhaseCard number={1} title="Research" description="Desk research and source mapping" status="completed" />
            <PhaseCard number={2} title="Data Collection" description="Parsing regulatory registries" status="active" />
            <PhaseCard number={3} title="Publication" description="Review, QA, and public release" status="upcoming" />
          </div>
        </Section>

        {/* ── Callout (Report Sections) ── */}
        <Section title="Callout" id="callout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Callout label="The Regulatory Vacuum" variant="accent">
              <p>Africa has no unified stablecoin regulation. Most countries are still figuring out whether to ban, tolerate, or integrate.</p>
              <CalloutStatGrid>
                <CalloutStat
                  value="42"
                  label="National currencies on the continent"
                  description="Almost zero have on-chain local pairs. Everything routes through USD — meaning USDT is the de facto reserve currency of African digital commerce."
                />
                <CalloutStat
                  value="$5B+"
                  label="Lost annually to FX costs in intra-African trade"
                  description="Correspondent banking fees, conversion spreads, and intermediary markups drain billions from the continent's economy every year."
                />
              </CalloutStatGrid>
              <Accordion className="st-accordion--report">
                <AccordionItem title="The patchwork: who's regulating, who's watching, who's ignoring">
                  <p>Regulatory approaches vary dramatically across African nations, from Nigeria's cautious licensing to Kenya's wait-and-see approach.</p>
                </AccordionItem>
                <AccordionItem title="What happens when regulators decide to act">
                  <p>When regulators move from observation to enforcement, the impact on local crypto ecosystems can be swift and disruptive.</p>
                </AccordionItem>
              </Accordion>
            </Callout>

            <Callout label="Key Insight" variant="info">
              <p>MiCA implementation across EU member states will create the first harmonized regulatory framework for digital assets, potentially becoming a global template.</p>
            </Callout>

            <Callout label="Risk Alert" variant="warning">
              <p>Jurisdictions without Travel Rule compliance by Q3 2026 risk being added to FATF grey lists, impacting cross-border transaction capabilities.</p>
            </Callout>
          </div>
        </Section>

        {/* ── StepFlow ── */}
        <Section title="Step Flow" id="stepflow">
          <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>Horizontal</h3>
          <StepFlow steps={[
            { number: 1, title: 'Sign Up', description: 'Create your account', status: 'completed' },
            { number: 2, title: 'Choose Plan', description: 'Select subscription tier', status: 'active' },
            { number: 3, title: 'Start Tracking', description: 'Access all jurisdictions', status: 'pending' },
          ]} />
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 'var(--type-heading-3)', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-main)' }}>Vertical</h3>
            <StepFlow direction="vertical" steps={[
              { number: 1, title: 'Application Submitted', description: 'Jan 15, 2026', status: 'completed' },
              { number: 2, title: 'Under Review', description: 'Feb 1, 2026', status: 'completed' },
              { number: 3, title: 'License Granted', description: 'Mar 10, 2026', status: 'active' },
              { number: 4, title: 'Operational', status: 'pending' },
            ]} />
          </div>
        </Section>

        {/* ── Timeline ── */}
        <Section title="Timeline" id="timeline">
          <Timeline events={[
            { date: 'Mar 2026', title: 'RemiDe v2 Launch', description: 'Unified platform with institute integration', badge: <Badge variant="accent" size="sm">Current</Badge> },
            { date: 'Feb 2026', title: 'Design System v1', description: 'Canonical token spec and component library' },
            { date: 'Jan 2026', title: 'Entity Database', description: 'Licensed VASP tracking across 40+ registries', badge: <Badge variant="success" size="sm">Live</Badge> },
            { date: 'Dec 2025', title: 'Tracker Beta', description: 'First public release of jurisdiction tracker' },
          ]} />
        </Section>

        {/* ── BigStatRow ── */}
        <Section title="Big Stat Row" id="bigstats">
          <BigStatRow stats={[
            { value: '164', suffix: '+', label: 'Jurisdictions' },
            { value: '2,400', suffix: '+', label: 'Licensed VASPs' },
            { value: '134', label: 'CBDCs Tracked' },
            { value: '40', suffix: '+', label: 'Registries Parsed' },
          ]} />
        </Section>

        {/* ── SidebarNav ── */}
        <Section title="Sidebar Nav" id="sidebarnav">
          <div style={{ maxWidth: 260 }}>
            <SidebarNav
              currentPath="/ui"
              sections={[
                { title: 'Getting Started', items: [
                  { label: 'Introduction', to: '/ui' },
                  { label: 'Installation', to: '/ui/install' },
                  { label: 'Tokens', to: '/ui/tokens', badge: <Badge variant="accent" size="sm">New</Badge> },
                ]},
                { title: 'Components', items: [
                  { label: 'Atoms', to: '/ui/atoms' },
                  { label: 'Molecules', to: '/ui/molecules' },
                  { label: 'Organisms', to: '/ui/organisms' },
                ]},
              ]}
            />
          </div>
        </Section>

        {/* ── ContentCardGrid ── */}
        <Section title="Content Card Grid" id="cardgrid">
          <ContentCardGrid columns={3}>
            <ContentCard title="Switzerland 🇨🇭" description="Full licensing framework with FINMA oversight" badge={<Badge variant="success" size="sm">Licensing</Badge>} to="#" />
            <ContentCard title="Singapore 🇸🇬" description="Payment Services Act with MAS licensing" badge={<Badge variant="success" size="sm">Licensing</Badge>} to="#" />
            <ContentCard title="Nigeria 🇳🇬" description="Central bank guidelines under development" badge={<Badge variant="warning" size="sm">In Progress</Badge>} to="#" />
          </ContentCardGrid>
        </Section>

        {/* ── ProseBlock ── */}
        <Section title="Prose Block" id="prose">
          <ProseBlock>
            <h2>Understanding Regulatory Fragmentation</h2>
            <p>
              The global regulatory landscape for digital assets remains deeply fragmented.
              While the European Union has established MiCA as a comprehensive framework,
              most jurisdictions operate with patchwork regulations that leave significant gaps.
            </p>
            <blockquote>
              Without harmonized standards, compliance costs will continue to rise,
              disproportionately affecting smaller market participants.
            </blockquote>
            <h3>Key Findings</h3>
            <div style={{ margin: '0 0 var(--space-4)' }}>
              <BulletItem icon={<IconInsight />}>Only 38% of surveyed jurisdictions have dedicated crypto licensing frameworks</BulletItem>
              <BulletItem icon={<IconInsight />}>Travel Rule implementation varies significantly across regions</BulletItem>
              <BulletItem icon={<IconInsight />}>CBDC development is accelerating, with 134 projects tracked globally</BulletItem>
            </div>
            <hr />
            <p>
              For a deeper analysis, see our <a href="#">full research report</a> covering
              regulatory developments across all 164 tracked jurisdictions.
            </p>
          </ProseBlock>
        </Section>

        {/* ── Diagrams ── */}
        <Section title="Diagrams" id="mermaid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            <h3 style={{ margin: 0 }}>VASP Licensing Flow — Semantic Status</h3>
            <p className="st-text st-text--sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              React Flow with <code>:::approved</code>, <code>:::rejected</code>, <code>:::active</code>, <code>:::pending</code> semantic classes
            </p>
            <FlowDiagram chart={`
graph TD
  A[VASP Application]:::active -->|Submit| B{Regulator Review}
  B -->|Approved| C[License Granted]:::approved
  B -->|Rejected| D[Appeal Process]:::rejected
  B -->|Incomplete| E[Request More Info]:::pending
  E -->|Resubmit| B
  C --> F[Operational]:::approved
  D -->|Upheld| C
  D -->|Denied| G[Application Closed]:::rejected
            `} />

            <h3 style={{ margin: 0 }}>Display Nodes — Key Statistics</h3>
            <FlowDiagram chart={`
graph LR
  A[847 VASPs Registered]:::display --> B[142 Jurisdictions]:::display
  B --> C[23 Pending Reviews]:::pending
            `} />

            <h3 style={{ margin: 0 }}>Inside Callout — Travel Rule</h3>
            <Callout label="Travel Rule Flow" variant="info">
              <p>FATF Recommendation 16 requires VASPs to share originator and beneficiary data during transfers.</p>
              <FlowDiagram chart={`
graph LR
  A[Originator VASP]:::active -->|Transfer + Data| B[Beneficiary VASP]:::active
  B -->|Confirm Receipt| A
  A -.->|Report| C[Regulator]:::muted
  B -.->|Report| D[Regulator]:::muted
              `} />
            </Callout>

            <Callout label="CBDC Architecture" variant="accent">
              <p>Central Bank Digital Currency implementation typically follows a two-tier model.</p>
              <FlowDiagram chart={`
graph TB
  CB[Central Bank]:::info -->|Issue CBDC| T1[Tier 1: Banks]:::active
  CB -->|Monetary Policy| T1
  T1 -->|Distribute| T2[Tier 2: Payment Providers]
  T2 -->|Wallets| U[End Users]
  U -->|P2P Transfer| U
  U -->|Payments| M[Merchants]
              `} />
            </Callout>

            <h3 style={{ margin: 0 }}>Sequence Diagram (Mermaid)</h3>
            <p className="st-text st-text--sm" style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Sequence diagrams remain rendered by Mermaid
            </p>
            <MermaidDiagram chart={`
sequenceDiagram
  participant V as VASP
  participant R as Regulator
  participant F as FATF
  V->>R: Submit License Application
  R->>R: AML/KYC Review
  Note over R: Risk Assessment
  R-->>V: Request Additional Docs
  V->>R: Provide Documents
  R->>F: Report Compliance Status
  Note over F: Mutual Evaluation
  F-->>R: Assessment Complete
  R->>V: License Approved
            `} />

          </div>
        </Section>

        {/* ── SegmentedControl ── */}
        <Section title="Segmented Control" id="segmented">
          <SegmentedDemo />
        </Section>

        {/* ── Breadcrumb ── */}
        <Section title="Breadcrumb" id="breadcrumb">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Breadcrumb crumbs={[
              { label: 'Home', to: '/' },
              { label: 'Jurisdictions', to: '/jurisdictions' },
              { label: 'Switzerland' },
            ]} />
            <Breadcrumb crumbs={[
              { label: 'Home', to: '/' },
              { label: 'Entities', to: '/entities' },
              { label: 'Crypto', to: '/entities?sector=crypto' },
              { label: 'Binance' },
            ]} />
          </div>
        </Section>

        {/* ── NavItem ── */}
        <Section title="NavItem" id="navitem">
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            maxWidth: 240, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: 8,
          }}>
            <NavItem to="/jurisdictions" label="Jurisdictions" icon={<span>🌍</span>} exact />
            <NavItem to="/entities" label="Entities" icon={<span>🏢</span>} badge={<Badge variant="neutral">11k</Badge>} />
            <NavItem to="/ui" label="Design System" icon={<span>🎨</span>} exact />
          </div>
        </Section>

        {/* ── LogoBar ── */}
        <Section title="LogoBar" id="logobar">
          <LogoBar
            label="Trusted by leading institutions"
            logos={[
              { src: 'https://placehold.co/120x40/21201C/F6F2EE?text=FATF', alt: 'FATF' },
              { src: 'https://placehold.co/120x40/21201C/F6F2EE?text=IMF', alt: 'IMF' },
              { src: 'https://placehold.co/120x40/21201C/F6F2EE?text=BIS', alt: 'BIS' },
              { src: 'https://placehold.co/120x40/21201C/F6F2EE?text=FSB', alt: 'FSB' },
              { src: 'https://placehold.co/120x40/21201C/F6F2EE?text=IOSCO', alt: 'IOSCO' },
            ]}
          />
        </Section>

        {/* ── DataTable (+ ColumnHeaderFilter) ── */}
        <Section title="DataTable" id="datatable">
          <p style={{ fontSize: 'var(--type-body-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Full-featured data table with sorting, search, pagination, and column header filters (ColumnHeaderFilter).
            Click "Type" header to open the filter popup.
          </p>
          <DataTableDemo />
        </Section>

        {/* ── Density Preview ── */}
        <Section title="Density" id="density">
          <p style={{ fontSize: 'var(--type-body)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Toggle comfortable/compact in the toolbar above. Components with density support
            adjust padding, font-size, and row-height.
          </p>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {['Switzerland', 'Singapore', 'United Kingdom', 'Japan', 'Brazil'].map((name, i) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `var(--density-padding-y, 12px) var(--density-padding-x, 16px)`,
                  fontSize: `var(--density-font-body, 14px)`,
                  lineHeight: `var(--density-line-height, 1.55)`,
                  borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none',
                  minHeight: `var(--density-row-height, 48px)`,
                }}
              >
                <span style={{ fontWeight: 500 }}>{name}</span>
                <Badge variant="success">Licensing</Badge>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Unique Elements ── */}
        <Section title="Unique Elements (requires special treatment)" id="unique">
          <p style={{ fontSize: 'var(--type-body)', color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            Elements that use programmatic colors and can't be tokenized with simple CSS var() replacement.
            Each needs a dedicated adaptation strategy.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              {
                name: 'WorldMap (MapLibre)',
                status: 'not-adapted',
                issue: 'MapLibre paint expressions don\'t support CSS variables. Colors from theme.ts are hardcoded hex.',
                fix: 'Read computed CSS vars at runtime via getComputedStyle() and pass resolved colors to MapLibre layers.',
              },
              {
                name: 'HeroWorldMapCanvas (Canvas 2D)',
                status: 'not-adapted',
                issue: 'Canvas 2D API uses raw rgba() values for dot colors and shine effects.',
                fix: 'Resolve --color-neutral and --color-accent via getComputedStyle(), rebuild canvas colors on theme change.',
              },
              {
                name: 'Badge colorMap System (theme.ts)',
                status: 'partial',
                issue: 'SEMANTIC_SWATCHES in theme.ts uses Tailwind hex palette. Works in light mode but breaks in dark themes.',
                fix: 'Migrate SEMANTIC_SWATCHES to use CSS var() strings. Badge component already supports both approaches.',
              },
              {
                name: 'Pricing Page — Custom Gradients',
                status: 'partial',
                issue: 'st-pricing-card uses dark section (#0A2540) with custom palette that doesn\'t follow theme tokens.',
                fix: 'Create pricing-specific surface tokens or redesign dark section to use --color-surface-raised.',
              },
              {
                name: 'Premium Badge — Brand Purple',
                status: 'by-design',
                issue: '#6C5CE7 / #7C3AED purple gradient for premium badges. Not part of the semantic color system.',
                fix: 'Add --color-premium and --color-premium-subtle tokens with theme-specific values.',
              },
              {
                name: 'PaywallGate — Blur Overlay',
                status: 'partial',
                issue: 'Uses rgba(255,255,255,0.75) backdrop which fails on dark themes.',
                fix: 'Use color-mix(in srgb, var(--color-bg) 75%, transparent) for theme-aware blur.',
              },
            ].map(item => (
              <div
                key={item.name}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--type-body)' }}>{item.name}</span>
                  <Badge
                    variant={item.status === 'not-adapted' ? 'danger' : item.status === 'partial' ? 'warning' : 'neutral'}
                    size="sm"
                  >
                    {item.status}
                  </Badge>
                </div>
                <p style={{ fontSize: 'var(--type-body-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  <strong>Issue:</strong> {item.issue}
                </p>
                <p style={{ fontSize: 'var(--type-body-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  <strong>Fix:</strong> {item.fix}
                </p>
              </div>
            ))}
          </div>
        </Section>

        </div>
      </div>
    </div>
  );
}
