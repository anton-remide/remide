import { useState } from 'react';
import { Send } from 'lucide-react';

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="st-card clip-lg" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <h5 style={{ marginBottom: 8 }}>Thank you!</h5>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          We'll get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <form className="st-contact-form clip-lg" onSubmit={handleSubmit}>
      <div className="st-form-grid st-form-grid--2 st-form-grid--1-mobile">
        <div>
          <input className="st-input" type="text" placeholder="Name" required />
        </div>
        <div>
          <input className="st-input" type="email" placeholder="Email" required />
        </div>
        <div className="st-form-grid__full">
          <textarea className="st-textarea" placeholder="Message" rows={4} required />
        </div>
        <div className="st-form-grid__full">
          <button type="submit" className="st-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Send Message <Send size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
