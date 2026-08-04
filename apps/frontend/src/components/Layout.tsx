import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div>
      <nav className="app-nav">
        <Link to="/" className="nav-brand">
          Reloop
        </Link>
        <NavLink to="/" end>
          Browse
        </NavLink>
        {user?.role === 'CONTRIBUTOR' && (
          <>
            <NavLink to="/listings/new">New listing</NavLink>
            <NavLink to="/my-listings">My listings</NavLink>
          </>
        )}
        {user?.role === 'MODERATOR' && (
          <>
            <NavLink to="/moderation">Moderation queue</NavLink>
            <NavLink to="/admin/categories">Categories</NavLink>
            <NavLink to="/admin/audit-log">Audit log</NavLink>
          </>
        )}
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
