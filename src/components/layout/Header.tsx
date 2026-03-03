import { useRef, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MobileMenu from './MobileMenu';
import HeaderSearch from './HeaderSearch';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (y > 200) {
        setHidden(y > lastY.current);
      } else {
        setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/jurisdictions', label: 'Jurisdictions' },
    { to: '/entities', label: 'Entities' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const cls = ['st-header'];
  if (scrolled) cls.push('scrolled');
  if (hidden) cls.push('hidden');

  return (
    <>
      <header ref={headerRef} className={cls.join(' ')}>
        <div className="st-header-inner">
          {/* Left: Logo */}
          <Link to="/" className="st-header-brand" aria-label="RemiDe Home">
            <img src={`${import.meta.env.BASE_URL}logo-full.svg`} alt="RemiDe" height={28} className="st-header-logo" />
          </Link>

          {/* Center: Search */}
          <HeaderSearch />

          {/* Right: Nav + Auth */}
          <nav className="st-header-nav">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={location.pathname.startsWith(link.to) ? 'active' : ''}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <button className="st-header-auth-btn" onClick={handleSignOut}>
                <span className="st-header-avatar">
                  {(user.email ?? '?')[0].toUpperCase()}
                </span>
                Sign Out
              </button>
            ) : (
              <>
                <Link to="/login" className="st-header-auth-link">Sign In</Link>
                <Link to="/signup" className="st-btn st-btn-sm">Sign Up</Link>
              </>
            )}
          </nav>

          <button
            className={`st-hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={navLinks}
        user={user}
        onSignOut={handleSignOut}
      />
    </>
  );
}
