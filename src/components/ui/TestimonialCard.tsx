import { Linkedin } from 'lucide-react';

export interface TestimonialCardProps {
  quote: string;
  authorName: string;
  authorRole?: string;
  authorAvatar?: string;
  linkedIn?: string;
  className?: string;
}

export default function TestimonialCard({ quote, authorName, authorRole, authorAvatar, linkedIn, className }: TestimonialCardProps) {
  return (
    <div className={['st-testimonial-card', className].filter(Boolean).join(' ')}>
      <blockquote className="st-testimonial-card__quote">
        <p>{quote}</p>
      </blockquote>
      <div className="st-testimonial-card__author">
        {authorAvatar && (
          <img
            src={authorAvatar}
            alt={authorName}
            className="st-testimonial-card__avatar"
            width={40}
            height={40}
          />
        )}
        <div>
          <div className="st-testimonial-card__name">
            {authorName}
            {linkedIn && (
              <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="st-testimonial-card__linkedin" aria-label={`${authorName} on LinkedIn`}>
                <Linkedin size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          {authorRole && <div className="st-testimonial-card__role">{authorRole}</div>}
        </div>
      </div>
    </div>
  );
}
