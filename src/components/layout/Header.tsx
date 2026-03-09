import { useRef, useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useClickOutside } from '../../hooks/useClickOutside';
import MobileMenu from './MobileMenu';
import HeaderSearch from './HeaderSearch';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false);
    setAvatarOpen(false);
  }, [location.pathname]);

  // Close avatar dropdown on click outside (E1 audit: extracted to hook)
  const closeAvatar = useCallback(() => setAvatarOpen(false), []);
  useClickOutside(avatarRef, closeAvatar);

  const navLinks = [
    { to: '/jurisdictions', label: 'Jurisdictions' },
    { to: '/entities', label: 'Entities' },
  ];

  const handleSignOut = async () => {
    setAvatarOpen(false);
    await signOut();
    navigate('/');
  };

  const cls = ['st-header'];
  if (scrolled) cls.push('scrolled');

  return (
    <>
      <header ref={headerRef} className={cls.join(' ')}>
        <div className="st-header-inner">
          {/* Left: Logo */}
          <div className="st-header-left">
            <Link to="/" className="st-header-brand" aria-label="RemiDe Home">
              <img src={`${import.meta.env.BASE_URL}logo-full.svg`} alt="RemiDe" height={28} className="st-header-logo st-logo-black" />
            </Link>
          </div>

          {/* Center: Search */}
          <div className="st-header-center">
            <HeaderSearch />
          </div>

          {/* Right: Nav + Auth */}
          <div className="st-header-right">
            <nav className="st-header-nav">
              <div className="st-header-nav-links">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={location.pathname.startsWith(link.to) ? 'active' : ''}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="st-header-nav-auth">
                {user ? (
                  <div ref={avatarRef} className="st-avatar-menu">
                    <button
                      className="st-avatar-trigger"
                      onClick={() => setAvatarOpen(!avatarOpen)}
                      aria-label="Account menu"
                      aria-haspopup="true"
                      aria-expanded={avatarOpen}
                    >
                      <span className="st-header-avatar">
                        {(user.email ?? '?')[0].toUpperCase()}
                      </span>
                    </button>
                    {avatarOpen && (
                      <div className="st-avatar-dropdown" role="menu">
                        <div className="st-avatar-dropdown-email">{user.email}</div>
                        <button className="st-avatar-dropdown-item" role="menuitem" onClick={handleSignOut}>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Link to="/login" className="st-header-auth-link">Sign In</Link>
                    <Link to="/signup" className="st-header-auth-link">Register</Link>
                  </>
                )}
              </div>
            </nav>
          </div>

          <button
            className={`st-hamburger${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Search size={20} />}
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
