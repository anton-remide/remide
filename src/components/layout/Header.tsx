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
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
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

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setAvatarOpen(false);
  }, [location.pathname]);

  // Close avatar dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navLinks = [
    { to: '/jurisdictions', label: 'Jurisdictions' },
    { to: '/entities', label: 'Entities' },
    { to: '/stablecoins', label: 'Stablecoins' },
  ];

  const handleSignOut = async () => {
    setAvatarOpen(false);
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
          <div className="st-header-left">
            <Link to="/" className="st-header-brand" aria-label="RemiDe Home">
              <img src={`${import.meta.env.BASE_URL}logo-full.svg`} alt="RemiDe" height={28} className="st-header-logo" />
            </Link>
          </div>

          {/* Center: Search */}
          <HeaderSearch />

          {/* Right: Nav + Auth */}
          <div className="st-header-right">
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
                <div ref={avatarRef} className="st-avatar-menu">
                  <button
                    className="st-avatar-trigger"
                    onClick={() => setAvatarOpen(!avatarOpen)}
                    aria-label="Account menu"
                  >
                    <span className="st-header-avatar">
                      {(user.email ?? '?')[0].toUpperCase()}
                    </span>
                  </button>
                  {avatarOpen && (
                    <div className="st-avatar-dropdown">
                      <div className="st-avatar-dropdown-email">{user.email}</div>
                      <button className="st-avatar-dropdown-item" onClick={handleSignOut}>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link to="/login" className="st-header-auth-link">Sign In</Link>
                  <Link to="/signup" className="st-btn st-btn-sm">Sign Up</Link>
                </>
              )}
            </nav>
          </div>

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
