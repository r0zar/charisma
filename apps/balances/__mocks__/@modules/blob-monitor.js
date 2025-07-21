// Mock for @modules/blob-monitor
export const BlobMonitor = jest.fn().mockImplementation(() => ({
  write: jest.fn(),
  read: jest.fn(),
  list: jest.fn()
}))

export default {
  BlobMonitor
}