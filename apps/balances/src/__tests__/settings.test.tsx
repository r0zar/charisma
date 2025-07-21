import { render, screen } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

describe('Settings Page', () => {
  it('renders settings page header', () => {
    render(<SettingsPage />)
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('displays basic functionality', () => {
    render(<SettingsPage />)
    
    // Just check that the component renders without errors
    expect(screen.getByText('Settings')).toBeInTheDocument()
    
    // Check for buttons (no links in this page)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders with proper accessibility', () => {
    render(<SettingsPage />)
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})