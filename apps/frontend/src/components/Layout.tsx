import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div>
      <nav className="app-nav">
        <Link to="/" className="nav-brand">
          Reloop
        </Link>
        <Link to="/">Browse</Link>
        {user?.role === 'CONTRIBUTOR' && (
          <>
            <Link to="/listings/new">New listing</Link>
            <Link to="/my-listings">My listings</Link>
          </>
        )}
        {user?.role === 'MODERATOR' && <Link to="/moderation">Moderation queue</Link>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {user ? (
            <>
              <span className="text-muted">
                {user.name} · {user.role === 'CONTRIBUTOR' ? 'Contributor' : 'Moderator'}
              </span>
              <button className="btn btn-secondary" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
      <div className="app-body">
        <Outlet />
      </div>
    </div>
  );
}
