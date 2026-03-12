import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import TopBanner from './components/layout/TopBanner';
import Footer from './components/layout/Footer';
import ErrorBoundary from './components/layout/ErrorBoundary';
import ScrollToTop from './components/layout/ScrollToTop';
import LandingPage from './pages/LandingPage';
import JurisdictionsPage from './pages/JurisdictionsPage';
import JurisdictionDetailPage from './pages/JurisdictionDetailPage';
import EntitiesPage from './pages/EntitiesPage';
import EntityDetailPage from './pages/EntityDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import StablecoinDetailPage from './pages/StablecoinDetailPage';
import CbdcDetailPage from './pages/CbdcDetailPage';
import IssuerDetailPage from './pages/IssuerDetailPage';
import PricingPage from './pages/PricingPage';
import WelcomePage from './pages/WelcomePage';
import NotFoundPage from './pages/NotFoundPage';

/* BrowserRouter basename — matches Vite base config.
   Dev: BASE_URL = '/'  →  basename = ''
   Prod: BASE_URL = '/remide/'  →  basename = '/remide' */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <ScrollToTop />
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <a href="#main-content" className="st-skip-link">Skip to main content</a>
        <TopBanner />
        <Header />
        <main id="main-content" style={{ flexGrow: 1 }}>
          <ErrorBoundary>
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

              {/* Redirects from old routes */}
              <Route path="/stablecoins" element={<Navigate to="/entities?tab=stablecoins" replace />} />

              {/* Detail routes — section-level paywall (progressive blur) */}
              <Route path="/jurisdictions/:code" element={<JurisdictionDetailPage />} />
              <Route path="/entities/:id" element={<EntityDetailPage />} />
              <Route path="/stablecoins/:id" element={<StablecoinDetailPage />} />
              <Route path="/cbdcs/:id" element={<CbdcDetailPage />} />
              <Route path="/issuers/:slug" element={<IssuerDetailPage />} />

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
