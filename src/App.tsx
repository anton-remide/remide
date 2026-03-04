import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import StickyBar from './components/layout/StickyBar';
import ErrorBoundary from './components/layout/ErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import JurisdictionsPage from './pages/JurisdictionsPage';
import JurisdictionDetailPage from './pages/JurisdictionDetailPage';
import EntitiesPage from './pages/EntitiesPage';
import EntityDetailPage from './pages/EntityDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import StablecoinsPage from './pages/StablecoinsPage';
import StablecoinDetailPage from './pages/StablecoinDetailPage';
import CbdcDetailPage from './pages/CbdcDetailPage';

export default function App() {
  return (
    <HashRouter>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flexGrow: 1 }}>
          <ErrorBoundary>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/jurisdictions" element={<JurisdictionsPage />} />
              <Route path="/stablecoins" element={<StablecoinsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected routes */}
              <Route path="/jurisdictions/:code" element={
                <ProtectedRoute><JurisdictionDetailPage /></ProtectedRoute>
              } />
              <Route path="/entities" element={
                <ProtectedRoute><EntitiesPage /></ProtectedRoute>
              } />
              <Route path="/entities/:id" element={
                <ProtectedRoute><EntityDetailPage /></ProtectedRoute>
              } />
              <Route path="/stablecoins/:id" element={
                <ProtectedRoute><StablecoinDetailPage /></ProtectedRoute>
              } />
              <Route path="/cbdcs/:id" element={
                <ProtectedRoute><CbdcDetailPage /></ProtectedRoute>
              } />
            </Routes>
          </ErrorBoundary>
        </main>
        <Footer />
        <StickyBar />
      </div>
    </HashRouter>
  );
}
