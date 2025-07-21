import { render, screen } from '@testing-library/react'
import SnapshotsPage from '@/app/snapshots/page'

describe('Snapshots Page', () => {
  it('renders snapshots page header', () => {
    render(<SnapshotsPage />)
    
    expect(screen.getByText('Snapshots')).toBeInTheDocument()
  })

  it('displays basic functionality', () => {
    render(<SnapshotsPage />)
    
    // Just check that the component renders without errors
    expect(screen.getByText('Snapshots')).toBeInTheDocument()
    
    // Check for any buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders with proper accessibility', () => {
    render(<SnapshotsPage />)
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})