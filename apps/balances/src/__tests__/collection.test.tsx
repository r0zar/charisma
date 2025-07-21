import { render, screen } from '@testing-library/react'
import CollectionPage from '@/app/collection/page'

describe('Collection Page', () => {

  it('renders collection page header', () => {
    render(<CollectionPage />)
    
    expect(screen.getByText('Balance Collection')).toBeInTheDocument()
  })

  it('displays basic functionality', () => {
    render(<CollectionPage />)
    
    // Just check that the component renders without errors
    expect(screen.getByText('Balance Collection')).toBeInTheDocument()
    
    // Check for any buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders with proper accessibility', () => {
    render(<CollectionPage />)
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})