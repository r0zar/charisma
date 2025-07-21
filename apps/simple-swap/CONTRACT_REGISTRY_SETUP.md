# Contract Registry Integration Setup

## Environment Variables Required

To use the contract-registry integration, you need to configure blob storage environment variables in your `.env.local` file:

```bash
# Required for contract-registry blob storage
BLOB_BASE_URL="https://your-vercel-blob-storage-url/"
BLOB_READ_WRITE_TOKEN="your-vercel-blob-token"

# Optional: KV storage for caching (recommended)
KV_URL="your-vercel-kv-url" 
KV_REST_API_URL="your-vercel-kv-rest-url"
KV_REST_API_TOKEN="your-vercel-kv-token"
KV_REST_API_READ_ONLY_TOKEN="your-vercel-kv-readonly-token"
```

## Getting Vercel Blob Storage Credentials

1. Go to your Vercel dashboard
2. Navigate to your project > Storage tab
3. Create a Blob storage if you don't have one
4. Copy the connection details to your `.env.local`

## Fallback Behavior

The integration includes automatic fallback to `@repo/tokens` when:
- Environment variables are not configured
- Contract registry initialization fails
- Contract registry is unavailable at runtime

This ensures your app continues to work even without contract-registry configuration.

## Testing

Visit `/test-registry-integration` in your app to test:
- Contract registry connection
- Token fetching functionality
- Fallback behavior

## Console Messages

When contract-registry is working:
```
[Contract Registry Adapter] Contract registry initialized successfully
[Contract Registry Adapter] Fetched 150 tokens
```

When fallback is used:
```
[Contract Registry Adapter] BLOB storage not configured, using fallback mode
[Contract Registry Adapter] Successfully using @repo/tokens fallback
```

## Migration Status

✅ **Completed:**
- Token metadata context updated
- Server actions updated  
- API routes updated
- Admin components updated
- Order execution logic updated

⏳ **Remaining (Optional):**
- Individual component updates (can be done gradually)
- Remove adapter layer once fully migrated
- Update remaining `getTokenMetadataCached` imports