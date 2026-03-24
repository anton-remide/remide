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
        const fontBody = s.getPropertyValue('--font-body').trim() || "'Geist', sans-serif";

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          fontFamily: fontBody,
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
            padding: 20,
            nodeSpacing: 50,
            rankSpacing: 56,
            curve: 'linear',
            htmlLabels: false,
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

        const bgColor = s.getPropertyValue('--color-bg').trim() || '#F6F2EE';
        const bgMatch = bgColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        const bgR = bgMatch ? parseInt(bgMatch[1], 16) : 246;
        const bgG = bgMatch ? parseInt(bgMatch[2], 16) : 242;
        const bgB = bgMatch ? parseInt(bgMatch[3], 16) : 238;

        const resolveVar = (varName: string): string => {
          const val = s.getPropertyValue(`--${varName}`).trim();
          if (!val) return '#888';
          const rgbaMatch = val.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
          if (rgbaMatch) {
            const r = Number(rgbaMatch[1]);
            const g = Number(rgbaMatch[2]);
            const b = Number(rgbaMatch[3]);
            const a = rgbaMatch[4] != null ? Number(rgbaMatch[4]) : 1;
            const blendR = Math.round(r * a + bgR * (1 - a));
            const blendG = Math.round(g * a + bgG * (1 - a));
            const blendB = Math.round(b * a + bgB * (1 - a));
            return `#${blendR.toString(16).padStart(2, '0')}${blendG.toString(16).padStart(2, '0')}${blendB.toString(16).padStart(2, '0')}`;
          }
          return val;
        };

        const resolvedChart = chart.trim().replace(
          /var\(--([a-zA-Z0-9-]+)\)/g,
          (_, varName) => resolveVar(varName),
        );

        const id = `mermaid_${uniqueId}_${Date.now()}`;
        const { svg: rendered } = await mermaid.render(id, resolvedChart);

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
