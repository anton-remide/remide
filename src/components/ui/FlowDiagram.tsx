import { useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseFlowchart } from './flow/parseFlowchart';
import { layoutDagre } from './flow/layoutDagre';
import DiagramNode from './flow/DiagramNode';
import DiagramEdge from './flow/DiagramEdge';

const nodeTypes = { diagram: DiagramNode };
const edgeTypes = { diagram: DiagramEdge };

const defaultEdgeOptions = {
  type: 'diagram' as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
};

export interface FlowDiagramProps {
  chart: string;
  className?: string;
}

export default function FlowDiagram({ chart, className }: FlowDiagramProps) {
  const { nodes, edges, height } = useMemo(() => {
    const parsed = parseFlowchart(chart);
    const layout = layoutDagre(parsed.nodes, parsed.edges, parsed.direction);

    const edgesWithMarker = parsed.edges.map((e) => ({
      ...e,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    }));

    return { nodes: layout.nodes, edges: edgesWithMarker, height: layout.height };
  }, [chart]);

  const classes = ['st-flow-diagram', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={{ height: Math.max(height, 120) }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={1.5}
        />
      </ReactFlowProvider>
    </div>
  );
}
