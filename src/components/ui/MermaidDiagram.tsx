import { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from '../../context/ThemeProvider';

export interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

async function getMermaid() {
  const m = await import('mermaid');
  return m.default;
}

export default function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = await getMermaid();

        const el = document.documentElement;
        const s = getComputedStyle(el);
        const surface = s.getPropertyValue('--color-surface').trim() || '#FFFFFF';
        const textMain = s.getPropertyValue('--color-text-main').trim() || '#21201C';
        const textSec = s.getPropertyValue('--color-text-secondary').trim() || '#63635E';
        const border = s.getPropertyValue('--color-border-strong').trim() || 'rgba(33,32,28,0.15)';
        const bg = s.getPropertyValue('--color-bg').trim() || '#F6F2EE';
        const accent = s.getPropertyValue('--color-accent').trim() || '#FF5F0F';

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          fontFamily: "'DM Sans', sans-serif",
          themeVariables: {
            background: 'transparent',
            primaryColor: surface,
            primaryBorderColor: border,
            primaryTextColor: textMain,
            lineColor: textSec,
            secondaryColor: bg,
            tertiaryColor: surface,
            noteBkgColor: bg,
            noteBorderColor: border,
            noteTextColor: textSec,
            actorBkg: surface,
            actorBorder: border,
            actorTextColor: textMain,
            actorLineColor: accent,
            signalColor: textMain,
            signalTextColor: textMain,
            labelBoxBkgColor: surface,
            labelTextColor: textSec,
            loopTextColor: textSec,
            edgeLabelBackground: bg,
            clusterBkg: 'transparent',
            clusterBorder: border,
            titleColor: textMain,
            nodeTextColor: textMain,
          },
          flowchart: {
            padding: 16,
            nodeSpacing: 50,
            rankSpacing: 56,
            curve: 'linear',
            htmlLabels: true,
            defaultRenderer: 'dagre-wrapper',
          },
          sequence: {
            actorMargin: 80,
            boxMargin: 10,
            noteMargin: 14,
            messageMargin: 45,
            mirrorActors: true,
            useMaxWidth: false,
          },
        });

        const id = `mermaid_${uniqueId}_${Date.now()}`;
        const { svg: rendered } = await mermaid.render(id, chart.trim());

        if (!cancelled) {
          setSvg(rendered);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvg('');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [chart, theme, uniqueId]);

  const classes = ['st-mermaid', className].filter(Boolean).join(' ');

  if (error) {
    return (
      <div className={`${classes} st-mermaid--error`}>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classes}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
