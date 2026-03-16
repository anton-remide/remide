import type { Node, Edge } from '@xyflow/react';

export type FlowDirection = 'TB' | 'LR' | 'TD';

export interface ParseResult {
  nodes: Node[];
  edges: Edge[];
  direction: FlowDirection;
}

interface RawNode {
  id: string;
  label: string;
  shape: 'rect' | 'diamond' | 'round';
  status?: string;
}

const DIRECTION_RE = /^(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)\s*$/;

const NODE_DEF_RE =
  /([A-Za-z_]\w*)\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(([^)]*)\))(?::::(\w+))?/;

const EDGE_RE =
  /([A-Za-z_]\w*)(?:\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(([^)]*)\))(?::::(\w+))?)?\s*(-->|-.->|==>)\s*(?:\|([^|]*)\|\s*)?([A-Za-z_]\w*)(?:\s*(?:\[([^\]]*)\]|\{([^}]*)\}|\(([^)]*)\))(?::::(\w+))?)?/;

function extractNodeInfo(
  id: string,
  rectLabel: string | undefined,
  diamondLabel: string | undefined,
  roundLabel: string | undefined,
  status: string | undefined,
): RawNode {
  let label = id;
  let shape: RawNode['shape'] = 'rect';

  if (diamondLabel !== undefined) {
    label = diamondLabel;
    shape = 'diamond';
  } else if (roundLabel !== undefined) {
    label = roundLabel;
    shape = 'round';
  } else if (rectLabel !== undefined) {
    label = rectLabel;
  }

  return { id, label: label.trim(), shape, status: status || undefined };
}

export function parseFlowchart(chart: string): ParseResult {
  const lines = chart.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  let direction: FlowDirection = 'TB';
  const nodeMap = new Map<string, RawNode>();
  const edges: Edge[] = [];
  let edgeIdx = 0;

  for (const line of lines) {
    const dirMatch = line.match(DIRECTION_RE);
    if (dirMatch) {
      const d = dirMatch[1] as string;
      direction = (d === 'TD' ? 'TB' : d) as FlowDirection;
      continue;
    }

    const edgeMatch = line.match(EDGE_RE);
    if (edgeMatch) {
      const [
        ,
        srcId,
        srcRect, srcDia, srcRound, srcStatus,
        edgeType,
        edgeLabel,
        tgtId,
        tgtRect, tgtDia, tgtRound, tgtStatus,
      ] = edgeMatch;

      if (!nodeMap.has(srcId)) {
        nodeMap.set(srcId, extractNodeInfo(srcId, srcRect, srcDia, srcRound, srcStatus));
      } else if (srcStatus && !nodeMap.get(srcId)!.status) {
        nodeMap.get(srcId)!.status = srcStatus;
      }

      if (!nodeMap.has(tgtId)) {
        nodeMap.set(tgtId, extractNodeInfo(tgtId, tgtRect, tgtDia, tgtRound, tgtStatus));
      } else if (tgtStatus && !nodeMap.get(tgtId)!.status) {
        nodeMap.get(tgtId)!.status = tgtStatus;
      }

      const animated = edgeType === '-.->';
      edges.push({
        id: `e${edgeIdx++}`,
        source: srcId,
        target: tgtId,
        label: edgeLabel?.trim() || undefined,
        type: 'diagram',
        animated: false,
        style: animated ? { strokeDasharray: '6 3' } : undefined,
        data: { dashed: animated },
      });
      continue;
    }

    const nodeMatch = line.match(NODE_DEF_RE);
    if (nodeMatch && !nodeMap.has(nodeMatch[1])) {
      const [, id, rectL, diaL, roundL, status] = nodeMatch;
      nodeMap.set(id, extractNodeInfo(id, rectL, diaL, roundL, status));
    }
  }

  const nodes: Node[] = Array.from(nodeMap.values()).map((raw) => ({
    id: raw.id,
    type: 'diagram',
    position: { x: 0, y: 0 },
    data: {
      label: raw.label,
      shape: raw.shape,
      status: raw.status,
    },
  }));

  return { nodes, edges, direction };
}
