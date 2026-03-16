export interface AuthorCardProps {
  name: string;
  role?: string;
  bio?: string;
  avatar?: string;
  layout?: 'landscape' | 'portrait';
  className?: string;
}

export default function AuthorCard({ name, role, bio, avatar, layout = 'landscape', className }: AuthorCardProps) {
  const classes = [
    'st-author-card',
    `st-author-card--${layout}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {avatar && (
        <img src={avatar} alt={name} className="st-author-card__avatar" />
      )}
      <div className="st-author-card__info">
        <div className="st-author-card__name">{name}</div>
        {role && <div className="st-author-card__role">{role}</div>}
        {bio && <p className="st-author-card__bio">{bio}</p>}
      </div>
    </div>
  );
}
