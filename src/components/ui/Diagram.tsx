import { lazy, Suspense } from 'react';

const MermaidDiagram = lazy(() => import('./MermaidDiagram'));

export interface DiagramProps {
  chart: string;
  className?: string;
}

export default function Diagram({ chart, className }: DiagramProps) {
  return (
    <Suspense fallback={<div className="st-mermaid" style={{ minHeight: 120 }} />}>
      <MermaidDiagram chart={chart} className={className} />
    </Suspense>
  );
}
