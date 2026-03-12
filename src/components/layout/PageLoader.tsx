/**
 * Full-page loading fallback for React.lazy() route code-splitting.
 * Shows a minimal shimmer skeleton that matches the site layout.
 */
export default function PageLoader() {
  return (
    <div className="st-page-loader" role="status" aria-label="Loading page">
      <div className="st-page-loader__bar" />
      <div className="st-page-loader__content">
        <div className="st-page-loader__title" />
        <div className="st-page-loader__line" />
        <div className="st-page-loader__line st-page-loader__line--short" />
        <div className="st-page-loader__block" />
      </div>
    </div>
  );
}
