import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/app.css';
import AuthProvider from './context/AuthProvider';
import App from './App';

if (window.location.hash.includes('figmacapture=')) {
  document.documentElement.classList.add('figma-capture-mode');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
