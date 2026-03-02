interface Props {
  label: string;
  colorMap: Record<string, { bg: string; text: string }>;
}

export default function Badge({ label, colorMap }: Props) {
  const c = colorMap[label] ?? { bg: '#f5f5f5', text: '#666' };
  return (
    <span className="st-badge" style={{ backgroundColor: c.bg, color: c.text }}>
      {label}
    </span>
  );
}
