import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Header } from '@/components/header';

// Mock the WalletDropdown component
vi.mock('@/components/wallet-dropdown', () => ({
  WalletDropdown: () => <div data-testid="wallet-dropdown">Wallet Dropdown</div>,
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('Header', () => {
  it('should render the header with logo', () => {
    render(<Header />);
    
    const logo = screen.getByRole('link', { name: /contract registry/i });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('href', '/');
  });
});