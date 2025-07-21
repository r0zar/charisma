# Trait Discovery Syntax Findings

## Summary

After extensive testing of different trait discovery patterns, we discovered the **correct minimal syntax** for trait-based contract discovery. The key insight is that the `args: []` field is **required** for pattern matching, even when empty.

## Working Syntax

```typescript
{
  name: "function-name",
  access: "public" | "read_only",
  args: []  // REQUIRED: empty array, cannot be omitted
}
```

## Test Results

### ❌ Patterns That Don't Work (0 contracts found)

```typescript
// 1. Just name - FAILS
{
  name: "transfer"
}

// 2. Name + access (no args field) - FAILS  
{
  name: "transfer",
  access: "public"
}

// 3. Name + access + undefined args - FAILS
{
  name: "transfer", 
  access: "public",
  args: undefined
}
```

### ✅ Pattern That Works (4,379+ contracts found)

```typescript
// Name + access + empty args array - WORKS!
{
  name: "transfer",
  access: "public", 
  args: []  // This field is mandatory
}
```

## Key Discovery

The trait discovery system requires the `args: []` field to be explicitly present, even for minimal pattern matching. Without this field, the pattern matcher returns 0 results.

## Confirmed Working Examples

### Transfer Function (4,379 contracts found)
```typescript
{
  trait: {
    name: 'Transfer',
    description: 'Transfer function',
    functions: [{
      name: "transfer",
      access: "public",
      args: []
    }]
  }
}
```

### Get-Name Function (expected to work)
```typescript
{
  trait: {
    name: 'GetName', 
    description: 'Get name function',
    functions: [{
      name: "get-name",
      access: "read_only",
      args: []
    }]
  }
}
```

## Context

- **Total SIP010 contracts in registry**: 2,578 (all discovered via "manual" method)
- **Trait discovery purpose**: Find NEW contracts, not re-analyze existing ones
- **SIP010**: Fungible Tokens, SIP009: NFTs
- **Discovery challenge**: Finding the exact syntax that matches real contract patterns

## Testing Process

1. **Initial Problem**: All trait discovery patterns returned 0 contracts
2. **Hypothesis**: Syntax was incorrect for pattern matching
3. **Testing Method**: Created systematic tests of 12+ minimal variations
4. **Discovery**: Pattern #3 ("Name + access + empty args") found 2,361-4,379 contracts
5. **Confirmation**: The `args: []` field is the critical missing piece

## Files Created

- `scripts/debug-minimal-transfer.ts` - Tests 12+ minimal transfer patterns
- `scripts/test-working-patterns.ts` - Focuses on the working pattern
- `scripts/confirm-syntax.ts` - Tests other functions with confirmed syntax

## Next Steps

With the correct syntax now confirmed, trait discovery can be used effectively to:
1. Find new contracts with specific function patterns
2. Discover contracts implementing custom traits
3. Build comprehensive contract classifications beyond manual methods

## Script Usage

```bash
# Test the working pattern
pnpm run script:test-working

# Test multiple minimal variations
pnpm run script:debug-minimal
```