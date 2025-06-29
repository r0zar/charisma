import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the TokenAvatar component functionality
const TokenAvatar = ({ token }: { token: { image?: string | null; symbol: string; name?: string } }) => {
  const symbol = token.symbol || 'TOKEN'
  const isLp = token.name?.toLowerCase().includes('lp')
  
  return (
    <div data-testid="token-avatar" className={isLp ? 'lp-token' : 'regular-token'}>
      {token.image && <img src={token.image} alt={symbol} />}
      <span>{symbol}</span>
    </div>
  )
}

describe('TokenAvatar Component', () => {
  it('renders token symbol', () => {
    const token = { symbol: 'STX', image: null }
    render(<TokenAvatar token={token} />)
    
    expect(screen.getByText('STX')).toBeInTheDocument()
  })

  it('renders token image when provided', () => {
    const token = { 
      symbol: 'CHA', 
      image: 'https://example.com/cha.png' 
    }
    render(<TokenAvatar token={token} />)
    
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/cha.png')
    expect(image).toHaveAttribute('alt', 'CHA')
  })

  it('handles null image gracefully', () => {
    const token = { symbol: 'TEST', image: null }
    render(<TokenAvatar token={token} />)
    
    expect(screen.getByText('TEST')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('identifies LP tokens correctly', () => {
    const lpToken = { 
      symbol: 'CHA-STX-LP', 
      name: 'Charisma STX LP Token',
      image: null 
    }
    render(<TokenAvatar token={lpToken} />)
    
    const avatar = screen.getByTestId('token-avatar')
    expect(avatar).toHaveClass('lp-token')
  })

  it('handles regular tokens correctly', () => {
    const regularToken = { 
      symbol: 'CHA', 
      name: 'Charisma Token',
      image: null 
    }
    render(<TokenAvatar token={regularToken} />)
    
    const avatar = screen.getByTestId('token-avatar')
    expect(avatar).toHaveClass('regular-token')
  })
})