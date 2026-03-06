/**
 * Per-page meta tag management for SEO.
 *
 * Sets document.title, meta description, Open Graph, Twitter Card,
 * canonical URL, and JSON-LD structured data.
 *
 * Usage:
 *   useDocumentMeta({
 *     title: 'Crypto Regulation Map — 206 Countries',
 *     description: 'Interactive map of cryptocurrency regulations...',
 *     path: '/jurisdictions',
 *   });
 */

import { useEffect } from 'react';

const SITE_NAME = 'RemiDe';
const SITE_URL = 'https://anton-remide.github.io/remide';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface DocumentMetaOptions {
  /** Page title (appended with " | RemiDe" unless noSuffix) */
  title: string;
  /** Meta description (max ~155 chars recommended) */
  description: string;
  /** Path for canonical URL (e.g. '/jurisdictions') */
  path?: string;
  /** Custom OG image URL */
  ogImage?: string;
  /** Don't append site name suffix to title */
  noSuffix?: boolean;
  /** JSON-LD structured data object */
  jsonLd?: Record<string, unknown>;
}

function setMetaTag(property: string, content: string, isName = false): void {
  const attr = isName ? 'name' : 'property';
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;

  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }

  el.setAttribute('content', content);
}

function setCanonical(url: string): void {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;

  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }

  el.setAttribute('href', url);
}

function setJsonLd(data: Record<string, unknown>): void {
  const id = 'json-ld-seo';
  let el = document.getElementById(id) as HTMLScriptElement | null;

  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }

  el.textContent = JSON.stringify(data);
}

export function useDocumentMeta(options: DocumentMetaOptions): void {
  useEffect(() => {
    const { title, description, path, ogImage, noSuffix, jsonLd } = options;

    // Title
    const fullTitle = noSuffix ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    // Meta description
    setMetaTag('description', description, true);

    // Canonical URL
    const canonicalUrl = path ? `${SITE_URL}${path}` : SITE_URL;
    setCanonical(canonicalUrl);

    // Open Graph
    setMetaTag('og:title', fullTitle);
    setMetaTag('og:description', description);
    setMetaTag('og:url', canonicalUrl);
    setMetaTag('og:image', ogImage || DEFAULT_OG_IMAGE);
    setMetaTag('og:type', 'website');
    setMetaTag('og:site_name', SITE_NAME);

    // Twitter Card
    setMetaTag('twitter:card', 'summary_large_image', true);
    setMetaTag('twitter:title', fullTitle, true);
    setMetaTag('twitter:description', description, true);
    setMetaTag('twitter:image', ogImage || DEFAULT_OG_IMAGE, true);

    // JSON-LD
    if (jsonLd) {
      setJsonLd(jsonLd);
    }

    // Cleanup: restore defaults on unmount
    return () => {
      document.title = `${SITE_NAME} — Stablecoin Intelligence Platform`;
    };
  }, [options.title, options.description, options.path, options.ogImage, options.noSuffix, options.jsonLd]);
}
