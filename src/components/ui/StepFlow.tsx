import type { ReactNode } from 'react';

export interface StepFlowStep {
  number: number;
  title: string;
  description?: string;
  icon?: ReactNode;
  status?: 'pending' | 'active' | 'completed';
}

export interface StepFlowProps {
  steps: StepFlowStep[];
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export default function StepFlow({ steps, direction = 'horizontal', className }: StepFlowProps) {
  return (
    <div className={[
      'st-step-flow',
      `st-step-flow--${direction}`,
      className,
    ].filter(Boolean).join(' ')} role="list">
      {steps.map((step, i) => (
        <div
          key={step.number}
          className={['st-step-flow__step', `st-step-flow__step--${step.status || 'pending'}`].filter(Boolean).join(' ')}
          role="listitem"
        >
          <div className="st-step-flow__indicator">
            {step.status === 'completed' ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              step.icon || <span>{step.number}</span>
            )}
          </div>
          {i < steps.length - 1 && <div className="st-step-flow__connector" />}
          <div className="st-step-flow__content">
            <div className="st-step-flow__title">{step.title}</div>
            {step.description && <div className="st-step-flow__desc">{step.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
