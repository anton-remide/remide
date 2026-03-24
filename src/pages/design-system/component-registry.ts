/**
 * Component registry — drives /ui/atoms index and per-component pages.
 * Plan 02: add entries when building or documenting components.
 */
export type ComponentCategory = 'atom' | 'molecule' | 'organism' | 'layout';
export type ComponentStatus = 'stable' | 'new' | 'experimental' | 'deprecated';

export interface PropDef {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  description: string;
}

export interface ComponentMeta {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  status: ComponentStatus;
  props: PropDef[];
  cssClasses: string[];
  relatedComponents?: string[];
}

const CATEGORY_ORDER: ComponentCategory[] = ['atom', 'molecule', 'organism', 'layout'];
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  atom: 'Atoms',
  molecule: 'Molecules',
  organism: 'Organisms',
  layout: 'Layout',
};

export { CATEGORY_ORDER, CATEGORY_LABELS };

export const COMPONENT_REGISTRY: ComponentMeta[] = [
  // ── Atoms ──
  { id: 'badge', name: 'Badge', description: 'Status and category labels with semantic variants.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-badge', 'st-badge--success', 'st-badge--info', 'st-badge--warning', 'st-badge--danger', 'st-badge--neutral'] },
  { id: 'button', name: 'Button', description: 'Primary action trigger with variants and sizes.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-btn', 'st-btn--primary', 'st-btn--secondary', 'st-btn--ghost', 'st-btn--danger'] },
  { id: 'input', name: 'Input', description: 'Text and form input with validation states.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-input'] },
  { id: 'heading', name: 'Heading', description: 'Foundation-driven display and heading roles.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-heading'] },
  { id: 'text', name: 'Text', description: 'Body and caption text with size/color variants.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-text'] },
  { id: 'chip', name: 'Chip', description: 'Selectable or removable tags and filters.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-chip'] },
  { id: 'toggle', name: 'Toggle', description: 'Boolean switch control.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-toggle'] },
  { id: 'spinner', name: 'Spinner', description: 'Loading indicator.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-spinner'] },
  { id: 'divider', name: 'Divider', description: 'Horizontal rule with optional label.', category: 'atom', status: 'stable', props: [], cssClasses: ['st-divider'] },
  // ── Molecules ──
  { id: 'statcard', name: 'StatCard', description: 'Metric card with value, label, and optional trend.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-stat-card'] },
  { id: 'contentcard', name: 'ContentCard', description: 'Card with title, description, badges, and link.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-content-card'] },
  { id: 'accordion', name: 'Accordion', description: 'Expandable content panels.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-accordion'] },
  { id: 'searchbar', name: 'SearchBar', description: 'Search input with icon and clear.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-search-bar'] },
  { id: 'inforow', name: 'InfoRow', description: 'Label-value row for key data.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-info-row'] },
  { id: 'ctablock', name: 'CTABlock', description: 'Call-to-action block with heading and buttons.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-cta-block'] },
  { id: 'pullquote', name: 'PullQuote', description: 'Highlighted quote block.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-pull-quote'] },
  { id: 'sectionheader', name: 'SectionHeader', description: 'Section title with optional subtitle and action.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-section-header'] },
  { id: 'filterchips', name: 'FilterChipGroup', description: 'Multi-select filter chips.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-filter-chip-group', 'st-filter-chip'] },
  { id: 'testimonial', name: 'TestimonialCard', description: 'Quote card with author and role.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-testimonial-card'] },
  { id: 'authorcard', name: 'AuthorCard', description: 'Author block with avatar and name.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-author-card'] },
  { id: 'imageheader', name: 'ImageHeader', description: 'Hero image with overlay and title.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-image-header'] },
  { id: 'bullets', name: 'BulletItem', description: 'List item with custom marker icons.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-bullet-item'] },
  { id: 'phasecards', name: 'PhaseCard', description: 'Phase or step card with status.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-phase-card'] },
  { id: 'callout', name: 'Callout', description: 'Info, warning, or tip callout with optional stats.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-callout', 'st-callout-stat-grid', 'st-callout-stat'] },
  { id: 'segmented', name: 'SegmentedControl', description: 'Segmented button group.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-segmented', 'st-segmented-btn'] },
  { id: 'breadcrumb', name: 'Breadcrumb', description: 'Navigation breadcrumb trail.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-breadcrumb'] },
  { id: 'navitem', name: 'NavItem', description: 'Navigation link with optional icon.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-nav-item'] },
  { id: 'logobar', name: 'LogoBar', description: 'Logo and partner strip.', category: 'molecule', status: 'stable', props: [], cssClasses: ['st-logo-bar'] },
  // ── Organisms ──
  { id: 'stepflow', name: 'StepFlow', description: 'Multi-step flow with progress.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-step-flow'] },
  { id: 'timeline', name: 'Timeline', description: 'Vertical timeline with events.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-timeline'] },
  { id: 'bigstats', name: 'BigStatRow', description: 'Row of large stat values.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-big-stat-row'] },
  { id: 'sidebarnav', name: 'SidebarNav', description: 'Sidebar navigation with sections.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-sidebar-nav'] },
  { id: 'cardgrid', name: 'ContentCardGrid', description: 'Responsive grid of content cards.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-content-card-grid'] },
  { id: 'prose', name: 'ProseBlock', description: 'Long-form prose with headings and lists.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-prose-block'] },
  { id: 'datatable', name: 'DataTable', description: 'Sortable, filterable data table with pagination.', category: 'organism', status: 'stable', props: [], cssClasses: ['st-data-table'] },
];

export function getComponentById(id: string): ComponentMeta | undefined {
  return COMPONENT_REGISTRY.find((c) => c.id === id);
}

export function getComponentsByCategory(cat: ComponentCategory): ComponentMeta[] {
  return COMPONENT_REGISTRY.filter((c) => c.category === cat);
}
