# Optional Field Inventory

This document tracks optional fields and patterns in the codebase.

## Summary

| Pattern | Count | Top Files |
|---------|-------|-----------|
| `?:` (optional property) | ~300+ | terminal-client.ts, blocks.ts, BlockManager.ts |
| `?.` (optional chaining) | ~400+ | terminal-client.ts, file-transfer.test.ts, BlockRenderer.ts |
| `??` (nullish coalescing) | ~100+ | Various |

## Top Files by Optional Properties (?:)

| File | Count | Category |
|------|-------|----------|
| terminal-client.ts | 50 | browser |
| blocks.ts | 33 | protocol |
| BlockManager.ts | 30 | browser |
| types.ts (shared) | 27 | browser |
| ai/types.ts | 22 | features |
| file-transfer.ts | 21 | features |
| useTerminal.ts | 18 | browser |
| claude-watcher/types.ts | 16 | features |

## Top Files by Optional Chaining (?.)

| File | Count | Category |
|------|-------|----------|
| terminal-client.ts | 75 | browser |
| file-transfer.test.ts | 44 | tests |
| block-store.test.ts | 23 | tests |
| BlockRenderer.ts | 22 | browser |
| ephemeral-executor.test.ts | 18 | tests |
| QuoteManager.ts | 18 | browser |
| ModifierKeyState.ts | 18 | browser |

## Categories

### Browser Code (High Optional Usage)
- WebSocket state management requires null checks
- DOM element references may be null
- Event handlers receive optional parameters

### Test Code
- Mocking requires optional properties
- Assertions may access undefined values
- This is acceptable

### Protocol/Types
- External data structures need optional fields
- This is the boundary layer

### Features
- Feature configuration uses optional fields
- File/process operations have optional results

## Recommendations

1. **Browser code**: Most `?.` usage is appropriate for DOM operations
2. **Test code**: Optional chaining in tests is acceptable
3. **Protocol types**: Create "Raw" types for external data, then validate
4. **Core domain**: Minimize optional fields, use discriminated unions instead

## Confining ?. to Boundaries

### Where ?. Is Acceptable

| Layer | Acceptable | Reason |
|-------|------------|--------|
| HTTP handlers | Yes | Parsing request body |
| Config loading | Yes | Raw file content |
| CLI arg parsing | Yes | User input |
| DOM operations | Yes | Element may not exist |
| Test assertions | Yes | Verifying optional values |

### Where ?. Should Be Avoided

| Layer | Avoid | Use Instead |
|-------|-------|-------------|
| Domain services | Yes | Discriminated unions |
| Business logic | Yes | Type guards |
| Internal APIs | Yes | Required types |

### Pattern: Validate First, Use Safely

```typescript
// BAD: ?. scattered throughout code
function processSession(session: Session | undefined) {
  const name = session?.name ?? 'unknown';
  const port = session?.port ?? 0;
  // ... more ?. usage
}

// GOOD: Validate at entry, use strict types inside
function processSession(session: Session) {
  const { name, port } = session;  // No ?. needed
  // ... clean code
}

// Boundary handles the optional
function handleSessionRequest(raw: unknown): Response {
  const session = parseSession(raw);
  if (isErr(session)) return resultResponse(session);

  return processSession(session.value);  // Guaranteed valid
}
```

## Restricting ?? (Nullish Coalescing) Usage

### Acceptable Uses

```typescript
// Config defaults - OK
const port = config.port ?? 7680;

// Environment variables - OK
const logLevel = process.env.LOG_LEVEL ?? 'info';

// Optional parameter defaults - OK
function connect(host: string, port = 80): void { ... }
```

### Should Be Avoided

```typescript
// BAD: Hiding missing required data
const sessionName = response?.session?.name ?? 'unknown';

// GOOD: Validate and fail explicitly
const session = parseSession(response);
if (isErr(session)) {
  return err(session.error);
}
const sessionName = session.value.name;  // Guaranteed to exist

// BAD: Fallback masking errors
const result = dangerousOperation() ?? defaultValue;

// GOOD: Handle error explicitly
const result = dangerousOperation();
if (isErr(result)) {
  log.warn('Operation failed, using default');
  return ok(defaultValue);
}
```

### Rule

Use `??` only for:
- Config/environment defaults
- Optional parameters with sensible defaults
- Never to mask potential errors or missing data

## Priority Areas

Files that would benefit most from reducing optionals:

1. `src/core/config/types.ts` - Domain config should have fewer optionals
2. `src/core/protocol/blocks.ts` - Define clearer block states
3. `src/browser/terminal/terminal-client.ts` - Consider state machine pattern

---

*Generated: 2026-03-21*
