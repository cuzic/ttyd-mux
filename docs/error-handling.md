# Error Handling Policy

This document defines when to use `Result<T, E>` types vs exceptions.

## Core Principle

- **Expected errors** → Return `Result<T, E>`
- **Unexpected errors** → Throw exceptions

## Definitions

### Expected Errors (Use Result)

Errors that are part of normal business logic:

| Category | Examples |
|----------|----------|
| Validation failures | Invalid input, missing required fields |
| Business rule violations | Session already exists, config invalid |
| Resource not found | Session not found, file not found |
| External service errors | Daemon not running, tmux not installed |
| Permission errors | Path traversal attempt, unauthorized access |

### Unexpected Errors (Throw)

Programmer errors or infrastructure failures:

| Category | Examples |
|----------|----------|
| Programming errors | Null pointer, array out of bounds |
| Configuration bugs | Missing dependency injection |
| System failures | Out of memory, disk full |
| Assertion failures | Invariant violations |

## Result Type Definition

```typescript
// src/utils/result.ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Helper functions
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
```

## Layer Responsibilities

### Service Layer

Services return `Result<T, DomainError>`:

```typescript
// Expected: Return Result
async function startSession(name: string): Promise<Result<Session, SessionError>> {
  if (await sessionExists(name)) {
    return err({ code: 'ALREADY_EXISTS', name });
  }
  // ...
  return ok(session);
}

// Unexpected: Let it throw
async function parseConfig(path: string): Config {
  // JSON.parse throws on invalid input - this is a programmer error
  // if the file was validated before being passed here
  return JSON.parse(readFileSync(path, 'utf-8'));
}
```

### Command Layer

Commands convert `Result` to exit codes and messages:

```typescript
async function upCommand(options: UpOptions): Promise<void> {
  const result = await startSession(options.name);

  if (!result.ok) {
    switch (result.error.code) {
      case 'ALREADY_EXISTS':
        console.log(`Session '${result.error.name}' is already running.`);
        return; // Exit code 0 - not an error for the user
      case 'DAEMON_NOT_RUNNING':
        throw new CliError('Daemon is not running');
    }
  }

  console.log(`Session started: ${result.value.name}`);
}
```

### HTTP Route Layer

Routes convert `Result` to HTTP responses:

```typescript
function handleStartSession(req: Request): Response {
  const result = await startSession(body.name);

  if (!result.ok) {
    return errorResponse(result.error);
  }

  return jsonResponse(result.value, 201);
}

function errorResponse(error: DomainError): Response {
  switch (error.code) {
    case 'ALREADY_EXISTS':
      return new Response(JSON.stringify({ error: error.code }), { status: 409 });
    case 'NOT_FOUND':
      return new Response(JSON.stringify({ error: error.code }), { status: 404 });
    default:
      return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}
```

## Domain Error Types

```typescript
// src/core/errors.ts
interface DomainError {
  readonly code: string;
  readonly message: string;
}

// Session errors
type SessionError =
  | { code: 'ALREADY_EXISTS'; name: string }
  | { code: 'NOT_FOUND'; name: string }
  | { code: 'INVALID_NAME'; reason: string };

// Config errors
type ConfigError =
  | { code: 'INVALID_YAML'; path: string; message: string }
  | { code: 'VALIDATION_FAILED'; field: string; message: string };

// Daemon errors
type DaemonError =
  | { code: 'NOT_RUNNING' }
  | { code: 'ALREADY_RUNNING' }
  | { code: 'START_FAILED'; message: string };
```

## Migration Strategy

### Phases

1. **Phase 0**: Document policy and create Result type ✅
2. **Phase 1**: Convert core services (session, daemon, config) ✅
3. **Phase 2**: Convert CLI commands and HTTP routes ✅
4. **Phase 3**: Add comprehensive tests ✅
5. **Phase 4**: Remove legacy error patterns (ongoing)

### Priority Migration Targets

High priority (new code should use Result):

| File | Status | Notes |
|------|--------|-------|
| `session-resolver.ts` | ✅ Result | `getSessionByName`, `getSessionForCwd` |
| `daemon-guard.ts` | ✅ Result | `checkDaemonRunning` |
| `command-runner.ts` | ✅ Result | `wrapResultCommand` |
| `http/utils.ts` | ✅ Result | `resultResponse`, `domainErrorResponse` |

Medium priority (migrate when modifying):

| File | Current | Target |
|------|---------|--------|
| `config.ts` | Throws | Result for validation errors |
| `state.ts` | Mixed | Result for read/write errors |
| `session.ts` | Mixed | Result for session operations |

Low priority (stable code):

| File | Reason |
|------|--------|
| `osc633-parser.ts` | Stable parsing logic |
| `html-template.ts` | Pure functions, rarely fails |

## What NOT to Use Result For

- **Async initialization** - Use try/catch at entry points
- **Stream processing** - Use EventEmitter error events
- **Constructor validation** - Use static factory methods with Result
- **Performance-critical paths** - Result adds object allocation overhead

## CliError vs Result Separation

### When to Use What

| Scenario | Use | Why |
|----------|-----|-----|
| Service layer validation | `Result` | Caller decides how to handle |
| Business logic errors | `Result` | Multiple callers may handle differently |
| CLI command errors | `Result` + `wrapResultCommand` | Unified error handling |
| Legacy code transition | `CliError` | Temporary until migrated |
| Interactive prompts | Throw | Not recoverable in current flow |

### CliError (Legacy Pattern)

```typescript
// Thrown when we want immediate exit with message
throw new CliError('Session not found', 1);

// Usage in wrapCommand
export function wrapCommand(fn) {
  return (...args) => {
    try {
      await fn(...args);
    } catch (error) {
      if (error instanceof CliError) {
        console.error(`Error: ${error.message}`);
        process.exit(error.exitCode);
      }
    }
  };
}
```

### Result (Preferred Pattern)

```typescript
// Return Result for caller to handle
return err(sessionNotFound(name));

// Usage in wrapResultCommand
export function wrapResultCommand(fn) {
  return (...args) => {
    const result = await fn(...args);
    if (isErr(result)) {
      console.error(`Error: ${formatCliError(result.error)}`);
      process.exit(toCliExitCode(result.error));
    }
  };
}
```

### Migration Path

1. **New code**: Use `Result` + `wrapResultCommand`
2. **Existing commands**: Keep using `CliError` + `wrapCommand`
3. **When modifying**: Consider migrating to Result pattern
4. **Eventually**: Phase out CliError usage

### Coexistence

Both patterns can coexist:

```typescript
// index.ts
program
  .command('up')
  .action(wrapCommand((options) => upCommand(options)));  // Legacy

program
  .command('status')
  .action(wrapResultCommand((options) => statusCommand(options)));  // New
```

## Handling Unexpected Exceptions

Unexpected exceptions (programmer errors, system failures) are handled at boundary layers:

### CLI Boundary

```typescript
// src/core/cli/command-runner.ts
export async function runResultCommand(fn: ResultCommandFn): Promise<void> {
  try {
    const result = await fn();
    if (isErr(result)) {
      console.error(`Error: ${formatCliError(result.error)}`);
      process.exit(toCliExitCode(result.error));
    }
    // Success handling...
  } catch (error) {
    // Unexpected error - log and exit with code 1
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}
```

### HTTP Boundary

```typescript
// API route wrapper
async function handleApiRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    // Log unexpected error (consider Sentry integration)
    console.error('Unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Guidelines

1. **Never swallow exceptions silently** - Always log unexpected errors
2. **Don't expose internal details** - Return generic "Internal error" to clients
3. **Consider error monitoring** - Use Sentry or similar for production
4. **Fail fast in development** - Don't catch-and-continue on programmer errors

## Reference Implementation

### Complete Example: Session Resolution

```typescript
// src/core/cli/helpers/session-resolver.ts

import { getSessions } from '@/core/client/index.js';
import type { Config, SessionResponse } from '@/core/config/types.js';
import { sessionNotFound, type SessionNotFoundError } from '@/core/errors.js';
import { err, ok, type Result } from '@/utils/result.js';

/**
 * Get session by name, returning Result
 */
export async function getSessionByName(
  config: Config,
  name: string
): Promise<Result<SessionResponse, SessionNotFoundError>> {
  const sessions = await getSessions(config);
  const session = sessions.find((s) => s.name === name);

  if (!session) {
    return err(sessionNotFound(name));
  }
  return ok(session);
}
```

### Complete Example: Command Runner

```typescript
// src/core/cli/command-runner.ts

import { type AnyDomainError, formatCliError, toCliExitCode } from '@/core/errors.js';
import { type Result, isErr } from '@/utils/result.js';

type ResultCommandResult = Result<void | number, AnyDomainError>;

export async function runResultCommand(
  fn: () => Promise<ResultCommandResult>
): Promise<void> {
  try {
    const result = await fn();

    if (isErr(result)) {
      console.error(`Error: ${formatCliError(result.error)}`);
      process.exit(toCliExitCode(result.error));
    }

    if (typeof result.value === 'number') {
      process.exit(result.value);
    }
  } catch (error) {
    console.error(`Error: ${getErrorMessage(error)}`);
    process.exit(1);
  }
}
```

### Complete Example: HTTP Response

```typescript
// src/core/server/http/utils.ts

import { type AnyDomainError, toHttpStatus } from '@/core/errors.js';
import { type Result, isErr } from '@/utils/result.js';

export function resultResponse<T>(
  result: Result<T, AnyDomainError>,
  options: { sentryEnabled?: boolean } = {}
): Response {
  const { sentryEnabled = false } = options;

  if (isErr(result)) {
    const status = toHttpStatus(result.error);
    return jsonResponse(
      { error: result.error.message, code: result.error.code },
      { status, sentryEnabled }
    );
  }

  return jsonResponse(result.value, { sentryEnabled });
}
```

## Testing

Test both success and error cases:

```typescript
describe('startSession', () => {
  test('returns ok with new session', async () => {
    const result = await startSession('new-session');
    expect(result.ok).toBe(true);
    expect(result.value.name).toBe('new-session');
  });

  test('returns error when session exists', async () => {
    await startSession('existing');
    const result = await startSession('existing');
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('ALREADY_EXISTS');
  });
});
```

## Deprecated Patterns (To Be Removed)

### Ambiguous Return Values

```typescript
// BAD: null could mean "not found" or "error"
function findSession(name: string): Session | null;

// GOOD: Explicit error type
function getSession(name: string): Result<Session, SessionNotFoundError>;
```

### Implicit Boolean Success

```typescript
// BAD: true/false doesn't convey why it failed
async function startSession(name: string): Promise<boolean>;

// GOOD: Returns error details
async function startSession(name: string): Promise<Result<Session, StartError>>;
```

### Generic Error Messages

```typescript
// BAD: Caller can't programmatically handle different errors
throw new Error('Session operation failed');

// GOOD: Typed error with code
return err({ code: 'SESSION_NOT_FOUND', sessionName: name });
```

### Console.log for Errors

```typescript
// BAD: Mixing output and error handling
if (!session) {
  console.error('Session not found');
  return;
}

// GOOD: Let caller handle output
return err(sessionNotFound(name));
```

---

*Last updated: 2026-03-21*
