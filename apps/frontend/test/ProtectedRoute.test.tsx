import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from './test-utils';
import ProtectedRoute from '../src/auth/ProtectedRoute';

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/secret" element={<div>secret content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>,
      { route: '/secret' },
    );
    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });
});
