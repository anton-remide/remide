import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Fade-up reveal for elements with class `.reveal` inside the container */
export function useReveal(trigger?: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll('.reveal');
    if (!els.length) return;

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

  useEffect(() => {
    if (!ref.current) return;
    const els = ref.current.querySelectorAll('.stagger-in');
    if (!els.length) return;

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

      ScrollTrigger.refresh();
    }, 100);

    return () => {
      clearTimeout(timer);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [trigger]);

  return ref;
}

/** Counter animation: animates numbers from 0 to target */
export function useCounter(target: number, duration = 2.5) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obj = { val: 0 };

    const timer = setTimeout(() => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: target,
            duration,
            ease: 'power2.out',
            onUpdate: () => {
              el.textContent = Math.round(obj.val).toLocaleString();
            },
          });
        },
      });

      ScrollTrigger.refresh();

      return () => trigger.kill();
    }, 150);

    return () => clearTimeout(timer);
  }, [target, duration]);

  return ref;
}
