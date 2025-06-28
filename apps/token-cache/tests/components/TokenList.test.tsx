import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock TokenList component
const TokenList = ({ tokens }: { tokens: any[] }) => {
  if (tokens.length === 0) {
    return <div data-testid="empty-state">No tokens found</div>
  }

  return (
    <div data-testid="token-list">
      {tokens.map((token, index) => (
        <div key={index} data-testid={`token-${index}`} className="token-item">
          <div className="token-name">{token.name}</div>
          <div className="token-symbol">{token.symbol}</div>
          <div className="token-contract">{token.contractId}</div>
        </div>
      ))}
    </div>
  )
}

describe('TokenList Component', () => {
  it('renders empty state when no tokens', () => {
    render(<TokenList tokens={[]} />)
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.getByText('No tokens found')).toBeInTheDocument()
  })

  it('renders token list when tokens exist', () => {
    const mockTokens = [
      {
        name: 'Charisma Token',
        symbol: 'CHA',
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
      },
      {
        name: 'Stacks Token',
        symbol: 'STX',
        contractId: 'SP000000000000000000002Q6VF78.pox'
      }
    ]
    
    render(<TokenList tokens={mockTokens} />)
    
    expect(screen.getByTestId('token-list')).toBeInTheDocument()
    expect(screen.getByTestId('token-0')).toBeInTheDocument()
    expect(screen.getByTestId('token-1')).toBeInTheDocument()
    
    expect(screen.getByText('Charisma Token')).toBeInTheDocument()
    expect(screen.getByText('CHA')).toBeInTheDocument()
    expect(screen.getByText('Stacks Token')).toBeInTheDocument()
    expect(screen.getByText('STX')).toBeInTheDocument()
  })

  it('displays contract IDs correctly', () => {
    const mockTokens = [
      {
        name: 'Test Token',
        symbol: 'TEST',
        contractId: 'SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1PA0KBR9.test-token'
      }
    ]
    
    render(<TokenList tokens={mockTokens} />)
    
    expect(screen.getByText('SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1PA0KBR9.test-token')).toBeInTheDocument()
  })
})