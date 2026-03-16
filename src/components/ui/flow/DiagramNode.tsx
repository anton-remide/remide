import { Handle, Position, type NodeProps } from '@xyflow/react';

type DiagramNodeData = {
  label: string;
  shape?: 'rect' | 'diamond' | 'round';
  status?: string;
};

export default function DiagramNode({ data, sourcePosition, targetPosition }: NodeProps) {
  const { label, shape = 'rect', status } = data as DiagramNodeData;

  const classes = [
    'st-diagram-node',
    shape === 'diamond' && 'st-diagram-node--diamond',
    shape === 'round' && 'st-diagram-node--round',
    status && `st-diagram-node--${status}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <Handle type="target" position={(targetPosition as Position) || Position.Top} />
      <span className="st-diagram-node__label">{label}</span>
      <Handle type="source" position={(sourcePosition as Position) || Position.Bottom} />
    </div>
  );
}
