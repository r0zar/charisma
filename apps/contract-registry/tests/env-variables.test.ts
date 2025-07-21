import { describe, it, expect } from 'vitest'

describe('Environment Variables', () => {
  it('should load required environment variables', () => {
    // Test that critical environment variables are loaded
    expect(process.env.BLOB_READ_WRITE_TOKEN).toBeDefined()
    expect(process.env.BLOB_BASE_URL).toBeDefined()
    expect(process.env.KV_URL).toBeDefined()
    expect(process.env.KV_REST_API_URL).toBeDefined()
    expect(process.env.KV_REST_API_TOKEN).toBeDefined()
    expect(process.env.HIRO_API_KEY).toBeDefined()
    expect(process.env.CRON_SECRET).toBeDefined()
  })

  it('should have NODE_ENV set to test in test environment', () => {
    expect(process.env.NODE_ENV).toBe('test')
  })

  it('should have valid URLs for external services', () => {
    expect(process.env.BLOB_BASE_URL).toMatch(/^https?:\/\//)
    expect(process.env.KV_REST_API_URL).toMatch(/^https?:\/\//)
    expect(process.env.KV_URL).toMatch(/^redis:\/\//)
  })
})