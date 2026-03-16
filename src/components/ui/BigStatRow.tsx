export interface BigStat {
  value: string;
  label: string;
  suffix?: string;
}

export interface BigStatRowProps {
  stats: BigStat[];
  className?: string;
}

export default function BigStatRow({ stats, className }: BigStatRowProps) {
  return (
    <div className={['st-big-stat-row', className].filter(Boolean).join(' ')}>
      {stats.map((stat, i) => (
        <div key={i} className="st-big-stat-row__item">
          <div className="st-big-stat-row__value">
            {stat.value}
            {stat.suffix && <span className="st-big-stat-row__suffix">{stat.suffix}</span>}
          </div>
          <div className="st-big-stat-row__label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
