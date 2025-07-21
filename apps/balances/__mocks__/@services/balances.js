// Mock for @services/balances
export const BalanceService = jest.fn().mockImplementation(() => ({
  getBalances: jest.fn(),
  createSnapshot: jest.fn(),
  getSnapshots: jest.fn()
}))

export const KVBalanceStore = jest.fn().mockImplementation(() => ({
  getBalance: jest.fn(),
  setBalance: jest.fn(),
  getAllBalances: jest.fn()
}))

export default {
  BalanceService,
  KVBalanceStore
}