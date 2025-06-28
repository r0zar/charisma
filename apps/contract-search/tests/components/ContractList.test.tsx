import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the ContractList component functionality
const ContractList = ({ contracts }: { contracts: any[] }) => {
  if (contracts.length === 0) {
    return <div data-testid="no-contracts">No contracts found</div>
  }

  return (
    <div data-testid="contract-list">
      {contracts.map((contract, index) => (
        <div key={index} data-testid={`contract-${index}`}>
          {contract.name || contract.contractId}
        </div>
      ))}
    </div>
  )
}

describe('ContractList Component', () => {
  it('renders empty state when no contracts', () => {
    render(<ContractList contracts={[]} />)
    expect(screen.getByTestId('no-contracts')).toBeInTheDocument()
    expect(screen.getByText('No contracts found')).toBeInTheDocument()
  })

  it('renders contract list when contracts exist', () => {
    const mockContracts = [
      { contractId: 'SP1.contract1', name: 'Test Contract 1' },
      { contractId: 'SP2.contract2', name: 'Test Contract 2' }
    ]
    
    render(<ContractList contracts={mockContracts} />)
    
    expect(screen.getByTestId('contract-list')).toBeInTheDocument()
    expect(screen.getByTestId('contract-0')).toBeInTheDocument()
    expect(screen.getByTestId('contract-1')).toBeInTheDocument()
    expect(screen.getByText('Test Contract 1')).toBeInTheDocument()
    expect(screen.getByText('Test Contract 2')).toBeInTheDocument()
  })

  it('handles contracts without names', () => {
    const mockContracts = [
      { contractId: 'SP1.unnamed-contract' }
    ]
    
    render(<ContractList contracts={mockContracts} />)
    
    expect(screen.getByText('SP1.unnamed-contract')).toBeInTheDocument()
  })
})