import { useCounter } from '../../hooks/useAnimations';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  value: number;
}

export default function StatCard({ icon: Icon, label, value }: Props) {
  const counterRef = useCounter(value);

  return (
    <div className="st-card clip-lg stagger-in" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: 'var(--bg-light)',
        marginBottom: 12,
      }}>
        <Icon size={14} color="var(--text-muted)" strokeWidth={1.5} />
      </div>
      <div className="stat-value"><span ref={counterRef}>0</span></div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
