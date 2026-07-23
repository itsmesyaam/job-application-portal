import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { JobApplicationForm } from '../src/components/JobApplicationForm';

// Mock NextAuth sessions
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}));

describe('Job Application Form Initial Gate Checks', () => {
  it('should render the login options on Step 1', () => {
    render(<JobApplicationForm />);
    
    // Check that sign-in headers and buttons exist
    expect(screen.getByText(/Step 1: Verify Your Identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign in with Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulate Demo Login/i)).toBeInTheDocument();
  });
});
