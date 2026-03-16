import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { FlowDirection } from './parseFlowchart';

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 44;

export interface LayoutResult {
  nodes: Node[];
  width: number;
  height: number;
}

export function layoutDagre(
  nodes: Node[],
  edges: Edge[],
  direction: FlowDirection = 'TB',
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 24,
    marginy: 24,
  });

  for (const node of nodes) {
    const w = node.data?.shape === 'diamond' ? DEFAULT_HEIGHT * 2.5 : DEFAULT_WIDTH;
    const h = DEFAULT_HEIGHT;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const graph = g.graph();

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    const w = node.data?.shape === 'diamond' ? DEFAULT_HEIGHT * 2.5 : DEFAULT_WIDTH;
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - DEFAULT_HEIGHT / 2,
      },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
    } as Node;
  });

  return {
    nodes: layoutedNodes,
    width: (graph.width ?? 400) + 48,
    height: (graph.height ?? 200) + 48,
  };
}
