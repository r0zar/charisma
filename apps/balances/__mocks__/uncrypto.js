// Mock for uncrypto module
export default {
  getRandomValues: jest.fn(() => new Uint8Array(16)),
  randomUUID: jest.fn(() => 'test-uuid-123'),
  subtle: {
    digest: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn()
  }
}

export const getRandomValues = jest.fn(() => new Uint8Array(16))
export const randomUUID = jest.fn(() => 'test-uuid-123')
export const subtle = {
  digest: jest.fn(),
  encrypt: jest.fn(),
  decrypt: jest.fn()
}