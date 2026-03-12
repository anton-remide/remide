import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function isFigmaCaptureMode() {
  return typeof window !== 'undefined' && window.location.hash.includes('figmacapture=');
}

/** Fade-up reveal for elements with class `.reveal` inside the container */
export function useReveal(trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll('.reveal');
    if (!els.length) return;
    if (isFigmaCaptureMode()) {
      gsap.set(els, { opacity: 1, y: 0, clearProps: 'animation' });
      return;
    }

    // Small delay to let layout settle (async map, images, etc.)
    const timer = setTimeout(() => {
      const triggers: ScrollTrigger[] = [];

      Array.from(els).forEach((el) => {
        // Reset initial state — subtle 20px lift
        gsap.set(el, { opacity: 0, y: 20 });

        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            start: 'top 90%',
            once: true,
            onEnter: () => {
              gsap.to(el, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' });
            },
          })
        );
      });

      // Refresh to pick up correct positions
      ScrollTrigger.refresh();

      return () => triggers.forEach((t) => t.kill());
    }, 100);

    return () => clearTimeout(timer);
  }, [trigger]);

  return ref;
}

/** Stagger reveal for elements with class `.stagger-in` inside the container */
export function useStaggerReveal(trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  // Track batch triggers for scoped cleanup (C2 audit fix)
  const batchRef = useRef<ScrollTrigger[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll('.stagger-in');
    if (!els.length) return;
    if (isFigmaCaptureMode()) {
      gsap.set(els, { opacity: 1, y: 0, clearProps: 'animation' });
      return;
    }

    // Snapshot triggers BEFORE creating batch
    const beforeIds = new Set(ScrollTrigger.getAll().map((t) => t.vars.id ?? t));

    const timer = setTimeout(() => {
      gsap.set(els, { opacity: 0, y: 24 });

      ScrollTrigger.batch(els, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'power3.out',
            stagger: 0.1,
          });
        },
      });

      // Store only NEW triggers created by batch (not counter/reveal triggers)
      batchRef.current = ScrollTrigger.getAll().filter((t) => !beforeIds.has(t.vars.id ?? t));

      ScrollTrigger.refresh();
    }, 100);

    return () => {
      clearTimeout(timer);
      // C2 audit fix: only kill batch triggers, not ALL triggers (was destroying counter animations)
      batchRef.current.forEach((t) => t.kill());
      batchRef.current = [];
    };
  }, [trigger]);

  return ref;
}

/** Counter animation: animates numbers from 0 to target (C2 audit fix) */
export function useCounter(target: number, duration = 2.5) {
  const ref = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    if (!ref.current || target <= 0) return;
    const el = ref.current;
    if (isFigmaCaptureMode()) {
      el.textContent = Math.round(target).toLocaleString();
      return;
    }
    const obj = { val: 0 };

    const animate = () => {
      gsap.to(obj, {
        val: target,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = Math.round(obj.val).toLocaleString();
        },
      });
    };

    // Delay slightly longer than stagger reveal (100ms) to avoid conflicts
    const timer = setTimeout(() => {
      triggerRef.current = ScrollTrigger.create({
        trigger: el,
        start: 'top 95%',
        once: true,
        onEnter: animate,
      });

      ScrollTrigger.refresh(true);

      // Fallback: if element was already in viewport, trigger may have fired but
      // check if scroll position is already past the start and animation hasn't run
      if (triggerRef.current.progress > 0 && obj.val === 0) {
        animate();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      triggerRef.current?.kill();
      triggerRef.current = null;
    };
  }, [target, duration]);

  return ref;
}
