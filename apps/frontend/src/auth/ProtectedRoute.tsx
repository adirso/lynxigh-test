import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { Role } from '../types/models';

export default function ProtectedRoute({ role }: { role?: Role }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <p className="app-body">You don&apos;t have access to this page.</p>;
  }
  return <Outlet />;
}
