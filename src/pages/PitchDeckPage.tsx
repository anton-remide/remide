import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowRight, Shield, Landmark, Network, Check, Zap, Globe, TrendingUp, Lock, Users, ChevronDown } from 'lucide-react';
import { useReveal } from '../hooks/useAnimations';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const TOTAL_SLIDES = 12;

/** Force nearblack theme on mount, restore previous on unmount */
function useForceDarkTheme() {
  useEffect(() => {
    const prev = document.documentElement.getAttribute('data-theme') || 'beige';
    document.documentElement.setAttribute('data-theme', 'nearblack');
    return () => {
      document.documentElement.setAttribute('data-theme', prev);
    };
  }, []);
}

/** Track which slide is in view */
function useActiveSlide() {
  const [active, setActive] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const slides = document.querySelectorAll('.st-pitch-slide');
    if (!slides.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.slide);
            if (!isNaN(idx)) setActive(idx);
          }
        }
      },
      { threshold: 0.5 }
    );

    slides.forEach((s) => observerRef.current!.observe(s));
    return () => observerRef.current?.disconnect();
  }, []);

  return active;
}

function SlideNav({ active }: { active: number }) {
  const scrollTo = useCallback((idx: number) => {
    document.getElementById(`slide-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <nav className="st-pitch-nav" aria-label="Slide navigation">
      {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
        <button
          key={i}
          className={`st-pitch-nav-dot${active === i ? ' is-active' : ''}`}
          onClick={() => scrollTo(i)}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </nav>
  );
}

export default function PitchDeckPage() {
  useForceDarkTheme();
  useDocumentMeta({
    title: 'RemiDe — Pre-Seed Pitch Deck',
    description: 'The clearing layer for institutional stablecoin payments. PRE-SEED · $1.7M · Q1 2026.',
    path: '/pitch',
  });

  const revealRef = useReveal();
  const activeSlide = useActiveSlide();

  return (
    <div ref={revealRef} className="st-pitch">
      <SlideNav active={activeSlide} />

      {/* ── Slide 1: Title ── */}
      <section className="st-pitch-slide st-pitch-slide--title" id="slide-0" data-slide={0}>
        <div className="st-pitch-slide-inner">
          <div className="st-pitch-badge reveal">PRE-SEED · $1.7M · Q1 2026</div>
          <img src="/logo-full.svg" alt="RemiDe" className="st-pitch-logo reveal" />
          <h1 className="st-pitch-title reveal">
            The clearing layer for institutional stablecoin payments.
          </h1>
          <div className="st-pitch-taglines reveal">
            <p><span className="st-pitch-accent">Unlocking Global Connectivity</span> — One integration for a compliant, cross-border financial network.</p>
            <p><span className="st-pitch-accent">Delivering Institutional Grade Infra</span> — Built for compliance, speed, and seamless settlement.</p>
            <p><span className="st-pitch-accent">Eliminating Clearing Friction</span> — The essential infrastructure to enable frictionless stablecoin clearing.</p>
          </div>
          <div className="st-pitch-scroll-hint reveal">
            <ChevronDown size={24} />
          </div>
        </div>
      </section>

      {/* ── Slide 2: Problem ── */}
      <section className="st-pitch-slide" id="slide-1" data-slide={1}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">1</span>
          <h2 className="st-pitch-heading reveal">
            The Stablecoin Reality:<br />High Volume, No Infrastructure
          </h2>
          <div className="st-pitch-stat-hero reveal">
            <span className="st-pitch-stat-value">$27T</span>
            <span className="st-pitch-stat-label">in stablecoin volume processed</span>
          </div>
          <p className="st-pitch-body reveal">
            But real-world payments remain limited because financial institutions lack a standardized way to send compliant payments to each other.
          </p>
          <div className="st-pitch-grid st-pitch-grid--3 reveal">
            <div className="st-pitch-card clip-lg">
              <Shield size={28} className="st-pitch-card-icon" />
              <h3>A Compliance Protocol</h3>
              <p>Allowing institutions to securely share verification data.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Network size={28} className="st-pitch-card-icon" />
              <h3>Standardized Corridors</h3>
              <p>Allowing institutions to leverage standardized payment paths.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Globe size={28} className="st-pitch-card-icon" />
              <h3>A Scalable Framework</h3>
              <p>Allowing institutions to bypass individual agreements and scale stablecoin payments globally.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 3: Missing Piece ── */}
      <section className="st-pitch-slide" id="slide-2" data-slide={2}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">2</span>
          <h2 className="st-pitch-heading reveal">
            The Missing Piece:<br />A Clearing Layer for Stablecoins
          </h2>
          <div className="st-pitch-comparison reveal">
            <div className="st-pitch-comparison-col">
              <h3 className="st-pitch-comparison-title">TradFi Fiat Payments</h3>
              <div className="st-pitch-layer st-pitch-layer--messaging">
                <span className="st-pitch-layer-label">Messaging</span>
                <strong>SWIFT</strong>
                <p>Sends payment instructions and identifies counterparties.</p>
              </div>
              <div className="st-pitch-layer st-pitch-layer--clearing">
                <span className="st-pitch-layer-label">Clearing</span>
                <strong>Correspondent Banking</strong>
                <p>Acts as the trust and coordination layer.</p>
              </div>
              <div className="st-pitch-layer st-pitch-layer--settlement">
                <span className="st-pitch-layer-label">Settlement</span>
                <strong>Fedwire / SEPA</strong>
                <p>Moves the funds.</p>
              </div>
            </div>
            <div className="st-pitch-comparison-col">
              <h3 className="st-pitch-comparison-title">Stablecoin Payments with RemiDe</h3>
              <div className="st-pitch-layer st-pitch-layer--messaging">
                <span className="st-pitch-layer-label">Messaging</span>
                <strong>Onchain</strong>
                <p>Payment instructions are embedded in the transaction.</p>
              </div>
              <div className="st-pitch-layer st-pitch-layer--clearing st-pitch-layer--accent">
                <span className="st-pitch-layer-label">Clearing</span>
                <strong>RemiDe</strong>
                <p>Verifying counterparties, exchanging compliance data, and coordinating the transaction before funds move.</p>
              </div>
              <div className="st-pitch-layer st-pitch-layer--settlement">
                <span className="st-pitch-layer-label">Settlement</span>
                <strong>Onchain</strong>
                <p>Funds settle instantly and are confirmed onchain.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 4: Regulatory Timing ── */}
      <section className="st-pitch-slide" id="slide-3" data-slide={3}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">3</span>
          <h2 className="st-pitch-heading reveal">The Time is Now</h2>
          <p className="st-pitch-body st-pitch-body--lead reveal">
            There is an urgent need for infrastructure that can coordinate stablecoin payments at scale.
          </p>
          <div className="st-pitch-grid st-pitch-grid--3 reveal">
            <div className="st-pitch-card clip-lg">
              <Landmark size={28} className="st-pitch-card-icon" />
              <h3>Regulatory Permission</h3>
              <p>Financial institutions can legally issue, hold, and use stablecoins for payments within defined regulatory frameworks: <strong>MiCA (EU)</strong> and <strong>GENIUS Act (US)</strong>.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Lock size={28} className="st-pitch-card-icon" />
              <h3>Strict Controls</h3>
              <p>Payment stablecoin issuers are treated as financial institutions. AML programs, sanctions controls, recordkeeping, and customer identification are required.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Zap size={28} className="st-pitch-card-icon" />
              <h3>Compliance in 2026</h3>
              <p>Transitional measures end <strong>July 2026</strong>. Supervision and enforcement begins this year. Institutions need compliant clearing infrastructure <em>now</em>.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 5: Solution ── */}
      <section className="st-pitch-slide" id="slide-4" data-slide={4}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">4</span>
          <h2 className="st-pitch-heading reveal">The RemiDe Solution</h2>
          <p className="st-pitch-body st-pitch-body--lead reveal">
            A network model that replaces bilateral integrations and extends to end users.
          </p>
          <div className="st-pitch-grid st-pitch-grid--2 reveal">
            <div className="st-pitch-card st-pitch-card--product clip-lg">
              <div className="st-pitch-product-badge">B2B Payments</div>
              <h3>RemiDe Match</h3>
              <p className="st-pitch-card-desc">A clearing network for financial institutions to send compliant stablecoin payments globally.</p>
              <ul className="st-pitch-checklist">
                <li><Check size={16} /> Turn your corridors into revenue</li>
                <li><Check size={16} /> Expand globally without cost</li>
                <li><Check size={16} /> Built-in compliant routing</li>
                <li><Check size={16} /> Direct settlement, no intermediaries</li>
              </ul>
            </div>
            <div className="st-pitch-card st-pitch-card--product clip-lg">
              <div className="st-pitch-product-badge">User Payments</div>
              <h3>RemiDe Direct</h3>
              <p className="st-pitch-card-desc">A global payment layer enabling users to send stablecoin payments across financial institutions.</p>
              <ul className="st-pitch-checklist">
                <li><Check size={16} /> Capture more volume and revenue</li>
                <li><Check size={16} /> Increase monetization per user</li>
                <li><Check size={16} /> Frictionless global payments</li>
                <li><Check size={16} /> Compliance, abstracted away</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 6: How It Works ── */}
      <section className="st-pitch-slide" id="slide-5" data-slide={5}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">5</span>
          <h2 className="st-pitch-heading reveal">RemiDe Match: How It Works</h2>
          <div className="st-pitch-flow reveal">
            <div className="st-pitch-flow-step">
              <div className="st-pitch-flow-node">OFI</div>
              <div className="st-pitch-flow-label">Payment Intent</div>
            </div>
            <div className="st-pitch-flow-connector" />
            <div className="st-pitch-flow-step st-pitch-flow-step--accent">
              <div className="st-pitch-flow-node st-pitch-flow-node--accent">RemiDe Match</div>
              <div className="st-pitch-flow-details">
                <span>Counterparty matching</span>
                <span>Compliance data collection</span>
                <span>Travel Rule data exchange</span>
                <span>Evidence bundle generation</span>
              </div>
            </div>
            <div className="st-pitch-flow-connector" />
            <div className="st-pitch-flow-step">
              <div className="st-pitch-flow-node">DFI</div>
              <div className="st-pitch-flow-label">Accepts + Approves</div>
            </div>
            <div className="st-pitch-flow-connector" />
            <div className="st-pitch-flow-step">
              <div className="st-pitch-flow-node">Pre-Cleared Transaction</div>
              <div className="st-pitch-flow-label">Stablecoin Transfer (OFI → DFI)</div>
            </div>
            <div className="st-pitch-flow-connector" />
            <div className="st-pitch-flow-step">
              <div className="st-pitch-flow-node">On-Chain Settlement</div>
              <div className="st-pitch-flow-label">Beneficiary Paid</div>
            </div>
          </div>
          <div className="st-pitch-flow-footer reveal">
            <div className="st-pitch-flow-footer-item"><strong>1. Connect</strong> — Join network, contribute corridors</div>
            <div className="st-pitch-flow-footer-item"><strong>2. Match</strong> — Compliance collected, counterparties verified</div>
            <div className="st-pitch-flow-footer-item"><strong>3. Settle</strong> — Funds move directly, full audit trail</div>
          </div>
        </div>
      </section>

      {/* ── Slide 7: Match Detail ── */}
      <section className="st-pitch-slide" id="slide-6" data-slide={6}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">6</span>
          <h2 className="st-pitch-heading reveal">Bilateral vs. Network Model</h2>
          <div className="st-pitch-grid st-pitch-grid--2 reveal">
            <div className="st-pitch-card clip-lg st-pitch-card--dim">
              <h3>Bilateral Model <span className="st-pitch-muted">(Today)</span></h3>
              <ul className="st-pitch-plain-list">
                <li>Negotiate Terms</li>
                <li>Exchange Compliance Manually</li>
                <li>Find Partners</li>
                <li>Build Integration</li>
                <li>Repeat Per Corridor</li>
              </ul>
              <p className="st-pitch-card-note">Establish corridors → Collect compliance → Send transactions → Payout → Settlement onchain</p>
            </div>
            <div className="st-pitch-card clip-lg st-pitch-card--highlight">
              <h3>Network Model <span className="st-pitch-accent">(with RemiDe)</span></h3>
              <div className="st-pitch-network-diagram">
                <div className="st-pitch-network-center">RemiDe Match<br /><span>(Clearing Layer)</span></div>
                <div className="st-pitch-network-nodes">
                  <span>OFI</span>
                  <span>DFI 1</span>
                  <span>DFI 2</span>
                  <span>DFI 3</span>
                </div>
              </div>
              <p className="st-pitch-card-note">One integration → Match counterparty → Pre-clear → Settlement onchain → Payout</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 8: Traction ── */}
      <section className="st-pitch-slide" id="slide-7" data-slide={7}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">7</span>
          <h2 className="st-pitch-heading reveal">Targets & Early Traction</h2>
          <div className="st-pitch-grid st-pitch-grid--2 reveal">
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-traction-icon">🚀</div>
              <h3>Production-Ready MVP</h3>
              <p>Core payment and compliance flow in final development.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-traction-icon">🌍</div>
              <h3>Regulatory Fast-Track</h3>
              <p>Kenya sandbox engagement secured for rapid corridor activation.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-traction-icon">🏦</div>
              <h3>Institutional Pilots</h3>
              <p>Deploying live testing with key remittance partners.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-traction-icon">📈</div>
              <h3>Organic Demand</h3>
              <p>High-intent lead generation via the Clearing Institute.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 9: Roadmap ── */}
      <section className="st-pitch-slide" id="slide-8" data-slide={8}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">8</span>
          <h2 className="st-pitch-heading reveal">Roadmap</h2>
          <div className="st-pitch-roadmap reveal">
            <div className="st-pitch-roadmap-phase st-pitch-roadmap-phase--done">
              <div className="st-pitch-roadmap-marker" />
              <h3>Phase 1 — Foundation</h3>
              <p>Core clearing protocol, compliance engine, counterparty matching MVP.</p>
            </div>
            <div className="st-pitch-roadmap-phase st-pitch-roadmap-phase--active">
              <div className="st-pitch-roadmap-marker" />
              <h3>Phase 2 — Launch</h3>
              <p>First live corridors (Kenya sandbox), institutional pilot integrations, Travel Rule exchange.</p>
            </div>
            <div className="st-pitch-roadmap-phase">
              <div className="st-pitch-roadmap-marker" />
              <h3>Phase 3 — Scale</h3>
              <p>Multi-corridor expansion, RemiDe Direct (user payments), additional jurisdictions.</p>
            </div>
            <div className="st-pitch-roadmap-phase">
              <div className="st-pitch-roadmap-marker" />
              <h3>Phase 4 — Network Effects</h3>
              <p>Industry standard protocol, global clearing network, revenue compounding.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 10: Economics ── */}
      <section className="st-pitch-slide" id="slide-9" data-slide={9}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">9</span>
          <h2 className="st-pitch-heading reveal">Infrastructure Economics</h2>
          <div className="st-pitch-econ-hero reveal">
            <h3>Scalable Fee Model</h3>
            <div className="st-pitch-stat-hero">
              <span className="st-pitch-stat-value">0.1–0.9%</span>
              <span className="st-pitch-stat-label">captured per transaction</span>
            </div>
            <p className="st-pitch-body">Our infrastructure model converts growing network volume into high-margin, compounding revenue.</p>
          </div>
          <div className="st-pitch-grid st-pitch-grid--3 reveal">
            <div className="st-pitch-card clip-lg">
              <TrendingUp size={28} className="st-pitch-card-icon" />
              <h3>Network Effect</h3>
              <p>Expanding corridors drive exponential value.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Zap size={28} className="st-pitch-card-icon" />
              <h3>Low Marginal Cost</h3>
              <p>Infrastructure efficiency maximizes profitability.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <Landmark size={28} className="st-pitch-card-icon" />
              <h3>Neutral Utility</h3>
              <p>Like SWIFT, we earn on every transaction we clear.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide 11: Moat ── */}
      <section className="st-pitch-slide" id="slide-10" data-slide={10}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">10</span>
          <h2 className="st-pitch-heading reveal">RemiDe's Moat</h2>
          <p className="st-pitch-body st-pitch-body--lead reveal">
            We provide the infrastructure layer, creating a durable competitive position through neutrality and network effects.
          </p>
          <div className="st-pitch-grid st-pitch-grid--3 reveal">
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-moat-num">1</div>
              <h3>Unrivaled Neutrality</h3>
              <p>Compliance-native routing trusted by all institutions because we favor none.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-moat-num">2</div>
              <h3>Compound Network Effects</h3>
              <p>Every new participant increases platform value, making switching cost-prohibitive.</p>
            </div>
            <div className="st-pitch-card clip-lg">
              <div className="st-pitch-moat-num">3</div>
              <h3>Industry Standard</h3>
              <p>We define the protocol; late entrants must conform to our existing standard.</p>
            </div>
          </div>
          <div className="st-pitch-callout clip-lg reveal">
            <h4>Why Neutral Players Win</h4>
            <p>Like SWIFT, our strength lies in our independence. Banks and stablecoin issuers cannot credibly own shared compliance infrastructure due to inherent conflicts of interest. Once corridors route through RemiDe, rebuilding outside our network becomes commercially unviable.</p>
          </div>
        </div>
      </section>

      {/* ── Slide 12: Team & Raise ── */}
      <section className="st-pitch-slide st-pitch-slide--final" id="slide-11" data-slide={11}>
        <div className="st-pitch-slide-inner">
          <span className="st-pitch-slide-num reveal">11</span>
          <h2 className="st-pitch-heading reveal">Team & Raise</h2>
          <div className="st-pitch-grid st-pitch-grid--2 reveal">
            <div className="st-pitch-team-card clip-lg">
              <img src="/anton-titov.png" alt="Anton Titov" className="st-pitch-team-photo" />
              <h3>Anton Titov</h3>
              <span className="st-pitch-team-role">CEO</span>
              <p>Payment infrastructure expert. Scaled cross-border corridors in 30+ regions.</p>
            </div>
            <div className="st-pitch-team-card clip-lg">
              <div className="st-pitch-team-photo st-pitch-team-photo--placeholder">
                <Users size={36} />
              </div>
              <h3>Roman Shprenger</h3>
              <span className="st-pitch-team-role">CTO</span>
              <p>Systems architect. Scaled high-throughput payment engines processing 50M+ daily events.</p>
            </div>
          </div>
          <div className="st-pitch-backers reveal">
            Backed by operators from: <strong>N26 · Chainalysis · Kraken · KuCoin</strong>
          </div>
          <div className="st-pitch-raise-card clip-lg reveal">
            <div className="st-pitch-raise-amount">$1.7M</div>
            <div className="st-pitch-raise-label">Pre-Seed</div>
            <p>Fueling live corridors, MVP completion, and institutional onboarding.</p>
            <div className="st-pitch-raise-close">Target Close: Q1 2026</div>
          </div>
          <a
            href="https://t.me/antotitov"
            target="_blank"
            rel="noopener noreferrer"
            className="st-pitch-cta reveal"
          >
            Book a Discovery Call <ArrowRight size={18} />
          </a>
          <div className="st-pitch-contact reveal">
            Telegram: @antotitov
          </div>
        </div>
      </section>
    </div>
  );
}
