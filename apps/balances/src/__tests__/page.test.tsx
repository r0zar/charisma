import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'

describe('Homepage', () => {
  it('renders the main heading', () => {
    render(<HomePage />)
    
    expect(screen.getByRole('heading', { level: 1, name: 'Balance Collection' })).toBeInTheDocument()
  })

  it('renders the hero description', () => {
    render(<HomePage />)
    
    expect(
      screen.getByText(/Track and manage Stacks blockchain balances with automated collection/i)
    ).toBeInTheDocument()
  })

  it('renders CTA buttons with icons', () => {
    render(<HomePage />)
    
    expect(screen.getByRole('link', { name: /View Dashboard/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Collect Balances/i })).toHaveAttribute('href', '/collection')
  })

  it('renders feature cards with titles', () => {
    render(<HomePage />)
    
    expect(screen.getByText('Real-time Collection')).toBeInTheDocument()
    expect(screen.getByText('Historical Snapshots')).toBeInTheDocument()
    expect(screen.getByText('Analytics & Monitoring')).toBeInTheDocument()
  })

  it('displays feature descriptions', () => {
    render(<HomePage />)
    
    expect(
      screen.getByText(/Automatically collect and track balances from multiple Stacks addresses/i)
    ).toBeInTheDocument()
    
    expect(
      screen.getByText(/Create compressed snapshots of balance data with automated scheduling/i)
    ).toBeInTheDocument()
    
    expect(
      screen.getByText(/Monitor collection performance, track trends/i)
    ).toBeInTheDocument()
  })

  it('renders footer with navigation links', () => {
    render(<HomePage />)
    
    // Check footer copyright
    expect(screen.getByText(/© 2024 Charisma Balance Collection/i)).toBeInTheDocument()
    
    // Check footer navigation links
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Collection' })).toHaveAttribute('href', '/collection')
    expect(screen.getByRole('link', { name: 'Snapshots' })).toHaveAttribute('href', '/snapshots')
  })

  it('renders UI components correctly', () => {
    render(<HomePage />)
    
    // Check that Button components are rendered (they should have the button role)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    
    // Check that Card components are rendered
    expect(screen.getByText('Real-time Collection').closest('[class*="card"]')).toBeInTheDocument()
  })

  it('has proper semantic structure', () => {
    render(<HomePage />)
    
    // Check main section
    expect(screen.getByRole('contentinfo')).toBeInTheDocument() // footer
    
    // Check that links are properly structured
    const links = screen.getAllByRole('link')
    expect(links.length).toBeGreaterThan(0)
  })
})