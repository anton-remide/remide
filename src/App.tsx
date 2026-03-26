import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import TopBanner from './components/layout/TopBanner';
import Footer from './components/layout/Footer';
import ErrorBoundary from './components/layout/ErrorBoundary';
import ScrollToTop from './components/layout/ScrollToTop';
import PageLoader from './components/layout/PageLoader';

/* ─── Route-level code splitting ───
   Each page loads its own JS chunk on demand.
   Shell (Header/Footer/TopBanner) stays in the main bundle. */
const LandingPage = lazy(() => import('./pages/LandingPage'));
const JurisdictionsPage = lazy(() => import('./pages/JurisdictionsPage'));
const JurisdictionDetailPage = lazy(() => import('./pages/JurisdictionDetailPage'));
const EntitiesPage = lazy(() => import('./pages/EntitiesPage'));
const EntityDetailPage = lazy(() => import('./pages/EntityDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const StablecoinDetailPage = lazy(() => import('./pages/StablecoinDetailPage'));
const CbdcDetailPage = lazy(() => import('./pages/CbdcDetailPage'));
const IssuerDetailPage = lazy(() => import('./pages/IssuerDetailPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
const PitchDeckPage = lazy(() => import('./pages/PitchDeckPage'));

/* BrowserRouter basename — matches Vite base config.
   Dev: BASE_URL = '/'  →  basename = ''
   Prod: BASE_URL = '/remide/'  →  basename = '/remide' */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Standalone routes render without Header/Footer (e.g. /pitch) */
const STANDALONE_PREFIXES = ['/pitch'];

function AppShell() {
  const { pathname } = useLocation();
  const isStandalone = STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <>
      <ScrollToTop />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {!isStandalone && (
          <>
            <a href="#main-content" className="st-skip-link">Skip to main content</a>
            <TopBanner />
            <Header />
          </>
        )}
        <main id="main-content" style={{ flexGrow: 1 }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/jurisdictions" element={<JurisdictionsPage />} />
                <Route path="/entities" element={<EntitiesPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/welcome" element={<WelcomePage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Redirects from old routes */}
                <Route path="/stablecoins" element={<Navigate to="/entities?tab=stablecoins" replace />} />

                {/* Detail routes — section-level paywall (progressive blur) */}
                <Route path="/jurisdictions/:code" element={<JurisdictionDetailPage />} />
                <Route path="/entities/:id" element={<EntityDetailPage />} />
                <Route path="/stablecoins/:id" element={<StablecoinDetailPage />} />
                <Route path="/cbdcs/:id" element={<CbdcDetailPage />} />
                <Route path="/issuers/:slug" element={<IssuerDetailPage />} />

                {/* Standalone pages */}
                <Route path="/pitch" element={<PitchDeckPage />} />

                {/* Design System preview (dev only) */}
                <Route path="/ui" element={<DesignSystemPage />} />
                <Route path="/ui/*" element={<DesignSystemPage />} />

                {/* 404 catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        {!isStandalone && <Footer />}
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AppShell />
    </BrowserRouter>
  );
}
