import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../src/auth/AuthContext';
import App from '../src/App';

describe('App', () => {
  it('renders the app shell', () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>,
    );
    expect(screen.getByRole('heading', { name: /reloop/i })).toBeInTheDocument();
  });
});
