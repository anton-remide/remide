/**
 * Smoke tests — every UI component renders without throwing.
 * These catch import errors, missing providers, and runtime crashes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Atoms
import Badge from '../Badge';
import Button from '../Button';
import Input from '../Input';
import Heading from '../Heading';
import Text from '../Text';
import Chip from '../Chip';
import Toggle from '../Toggle';
import Spinner from '../Spinner';
import Divider from '../Divider';

// Molecules
import StatCard from '../StatCard';
import Accordion, { AccordionItem } from '../Accordion';
import ContentCard from '../ContentCard';
import SearchBar from '../SearchBar';
import InfoRow from '../InfoRow';
import CTABlock from '../CTABlock';
import PullQuote from '../PullQuote';
import SectionHeader from '../SectionHeader';
import FilterChipGroup from '../FilterChipGroup';
import TestimonialCard from '../TestimonialCard';
import AuthorCard from '../AuthorCard';
import ImageHeader from '../ImageHeader';
import BulletItem from '../BulletItem';
import PhaseCard from '../PhaseCard';
import Callout, { CalloutStatGrid, CalloutStat } from '../Callout';
import FormField from '../FormField';
import Breadcrumb from '../Breadcrumb';
import NavItem from '../NavItem';
import SegmentedControl from '../SegmentedControl';
import LogoBar from '../LogoBar';

// Organisms
import StepFlow from '../StepFlow';
import Timeline from '../Timeline';
import BigStatRow from '../BigStatRow';
import SidebarNav from '../SidebarNav';
import ContentCardGrid from '../ContentCardGrid';
import ProseBlock from '../ProseBlock';
import MermaidDiagram from '../MermaidDiagram';
import DataTable from '../DataTable';

// Mock ThemeProvider (used by MermaidDiagram)
vi.mock('../../../context/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'beige', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  THEMES: ['beige', 'darkgray', 'nearblack'],
}));

// Mock mermaid (heavy dep)
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

function withRouter(ui: ReactNode, route = '/') {
  return <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>;
}

// ── Atoms ──

describe('Badge', () => {
  it('renders', () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('renders', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  it('renders loading state', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" placeholder="you@example.com" />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });
});

describe('Heading', () => {
  it('renders h1', () => {
    render(<Heading level={1}>Title</Heading>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });
  it('renders display', () => {
    render(<Heading display>Big Title</Heading>);
    expect(screen.getByText('Big Title')).toBeInTheDocument();
  });
});

describe('Text', () => {
  it('renders', () => {
    render(<Text>Body text</Text>);
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });
});

describe('Chip', () => {
  it('renders', () => {
    render(<Chip>Licensing</Chip>);
    expect(screen.getByText('Licensing')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('renders', () => {
    const { container } = render(<Toggle label="Dark mode" />);
    expect(container.querySelector('input[type="checkbox"]')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('renders', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.st-spinner')).toBeInTheDocument();
  });
});

describe('Divider', () => {
  it('renders', () => {
    const { container } = render(<Divider />);
    expect(container.querySelector('.st-divider')).toBeInTheDocument();
  });
  it('renders with label', () => {
    render(<Divider label="OR" />);
    expect(screen.getByText('OR')).toBeInTheDocument();
  });
});

// ── Molecules ──

describe('StatCard', () => {
  it('renders', () => {
    render(<StatCard value="207" label="Jurisdictions" />);
    expect(screen.getByText('207')).toBeInTheDocument();
    expect(screen.getByText('Jurisdictions')).toBeInTheDocument();
  });
});

describe('Accordion', () => {
  it('renders items', () => {
    render(
      <Accordion>
        <AccordionItem title="Section 1">Content 1</AccordionItem>
        <AccordionItem title="Section 2">Content 2</AccordionItem>
      </Accordion>,
    );
    expect(screen.getByText('Section 1')).toBeInTheDocument();
    expect(screen.getByText('Section 2')).toBeInTheDocument();
  });
});

describe('ContentCard', () => {
  it('renders', () => {
    render(<ContentCard title="Test Card" description="A description" />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });
});

describe('SearchBar', () => {
  it('renders', () => {
    render(<SearchBar placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });
});

describe('InfoRow', () => {
  it('renders', () => {
    render(<InfoRow label="Status" value="Active" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('CTABlock', () => {
  it('renders', () => {
    render(<CTABlock title="Get Started">Sign up now</CTABlock>);
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });
});

describe('PullQuote', () => {
  it('renders', () => {
    render(<PullQuote citation="Author">A profound statement</PullQuote>);
    expect(screen.getByText('A profound statement')).toBeInTheDocument();
  });
});

describe('SectionHeader', () => {
  it('renders', () => {
    render(<SectionHeader title="Overview" subtitle="Key metrics" />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });
});

describe('FilterChipGroup', () => {
  it('renders', () => {
    render(
      <FilterChipGroup
        options={[{ id: 'a', label: 'Option A' }, { id: 'b', label: 'Option B' }]}
        selected={new Set(['a'])}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });
});

describe('TestimonialCard', () => {
  it('renders', () => {
    render(<TestimonialCard quote="Great product" authorName="John Doe" authorRole="CEO" />);
    expect(screen.getByText('Great product')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});

describe('AuthorCard', () => {
  it('renders landscape', () => {
    render(<AuthorCard name="Jane Smith" role="CTO" layout="landscape" />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
  it('renders portrait', () => {
    render(<AuthorCard name="Jane Smith" layout="portrait" />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});

describe('ImageHeader', () => {
  it('renders', () => {
    render(<ImageHeader title="Report" subtitle="2026 Edition" />);
    expect(screen.getByText('Report')).toBeInTheDocument();
  });
});

describe('BulletItem', () => {
  it('renders', () => {
    render(<BulletItem>Key insight</BulletItem>);
    expect(screen.getByText('Key insight')).toBeInTheDocument();
  });
  it('renders with variant', () => {
    render(<BulletItem variant="success">Done</BulletItem>);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});

describe('PhaseCard', () => {
  it('renders', () => {
    render(<PhaseCard number={1} title="Research" description="Gather data" status="active" />);
    expect(screen.getByText('Research')).toBeInTheDocument();
  });
});

describe('Callout', () => {
  it('renders', () => {
    render(<Callout label="Note" variant="info">Important info</Callout>);
    expect(screen.getByText('Important info')).toBeInTheDocument();
  });
  it('renders stat grid', () => {
    render(
      <Callout>
        <CalloutStatGrid>
          <CalloutStat value="42" label="Countries" />
        </CalloutStatGrid>
      </Callout>,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

describe('FormField', () => {
  it('renders', () => {
    render(<FormField label="Name"><input /></FormField>);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});

// ── Molecules (require MemoryRouter) ──

describe('Breadcrumb', () => {
  it('renders', () => {
    render(withRouter(
      <Breadcrumb crumbs={[{ label: 'Home', to: '/' }, { label: 'Current' }]} />,
    ));
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });
});

describe('NavItem', () => {
  it('renders', () => {
    render(withRouter(<NavItem to="/test" label="Test Page" />));
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  it('renders', () => {
    render(
      <SegmentedControl
        options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});

describe('LogoBar', () => {
  it('renders', () => {
    render(
      <LogoBar
        label="Partners"
        logos={[{ src: '/logo.png', alt: 'Partner' }]}
      />,
    );
    expect(screen.getByText('Partners')).toBeInTheDocument();
    expect(screen.getByAltText('Partner')).toBeInTheDocument();
  });
});

// ── Organisms ──

describe('StepFlow', () => {
  it('renders horizontal', () => {
    render(
      <StepFlow steps={[
        { number: 1, title: 'Apply' },
        { number: 2, title: 'Review' },
      ]} />,
    );
    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });
  it('renders vertical', () => {
    render(
      <StepFlow direction="vertical" steps={[
        { number: 1, title: 'Step A' },
      ]} />,
    );
    expect(screen.getByText('Step A')).toBeInTheDocument();
  });
});

describe('Timeline', () => {
  it('renders', () => {
    render(
      <Timeline events={[
        { date: '2024', title: 'Founded' },
        { date: '2025', title: 'Launched' },
      ]} />,
    );
    expect(screen.getByText('Founded')).toBeInTheDocument();
    expect(screen.getByText('Launched')).toBeInTheDocument();
  });
});

describe('BigStatRow', () => {
  it('renders', () => {
    render(
      <BigStatRow stats={[
        { value: '207', label: 'Countries' },
        { value: '11K', label: 'Entities' },
      ]} />,
    );
    expect(screen.getByText('207')).toBeInTheDocument();
    expect(screen.getByText('11K')).toBeInTheDocument();
  });
});

describe('SidebarNav', () => {
  it('renders', () => {
    render(withRouter(
      <SidebarNav sections={[
        { title: 'Main', items: [{ label: 'Home', to: '/' }] },
      ]} />,
    ));
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});

describe('ContentCardGrid', () => {
  it('renders', () => {
    render(
      <ContentCardGrid>
        <div>Card 1</div>
        <div>Card 2</div>
      </ContentCardGrid>,
    );
    expect(screen.getByText('Card 1')).toBeInTheDocument();
  });
});

describe('ProseBlock', () => {
  it('renders', () => {
    render(<ProseBlock><p>Paragraph text</p></ProseBlock>);
    expect(screen.getByText('Paragraph text')).toBeInTheDocument();
  });
});

describe('MermaidDiagram', () => {
  it('renders without crashing', () => {
    const { container } = render(<MermaidDiagram chart="graph TD; A-->B" />);
    expect(container.querySelector('.st-mermaid')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('renders with minimal data', () => {
    render(
      <DataTable
        columns={[
          { key: 'name', label: 'Name', sortable: true },
          { key: 'status', label: 'Status' },
        ]}
        data={[{ name: 'Binance', status: 'Licensed' }]}
        sort={{ field: 'name', direction: 'asc' }}
        onSort={() => {}}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        totalFiltered={1}
        totalCount={1}
      />,
    );
    expect(screen.getByText('Binance')).toBeInTheDocument();
    expect(screen.getByText('Licensed')).toBeInTheDocument();
  });
});
