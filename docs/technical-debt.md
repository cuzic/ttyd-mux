# Technical Debt Registry

This document tracks known technical debt items discovered during code reviews.

## Completed Items

Items that have been addressed:

| Item | Priority | Status | Addressed |
|------|----------|--------|-----------|
| Empty implementations in reload.ts, caddy.ts | P0 | ✅ Done | Added proper output messages |
| process.exit() in command implementations | P0 | ✅ Done | Moved to command-runner.ts |
| Callback-based readline in attach.ts | P0 | ✅ Done | Converted to readline/promises |
| CLI output inconsistency | P1 | ✅ Done | Created cli-output-policy.md |
| Missing --json options | P1 | ✅ Done | Added to list, status, doctor |
| Session helper duplication | P1 | ✅ Done | Created daemon-guard.ts |
| Export-only tests | P1 | ✅ Done | Added behavior-based tests |
| Claude Quotes API if-chain routing | P2 | ✅ Done | Converted to table-driven |
| Markdown scanner performance | P2 | ✅ Done | Added limits and exclusions |
| Directory structure undocumented | P2 | ✅ Done | Created directory-structure.md |
| CLI UX hints inconsistency | P3 | ✅ Done | Fixed reload.ts hint |
| tmux check incorrectly marked as required | P3 | ✅ Done | Changed to ok=true with optional |

## Open Items

### P1 - Should Address Soon

#### API Client lacks DI for testing
- **Location**: `src/core/client/api-client.ts`
- **Description**: The API client uses `fetch` directly, making it hard to unit test commands that depend on API responses.
- **Impact**: Tests can only verify daemon-not-running cases
- **Suggested Fix**: Add optional `fetch` parameter or create `ApiClient` interface

#### HTTP handler uses if-chain routing
- **Location**: `src/core/server/http-handler.ts`
- **Description**: Similar to Claude Quotes API, the main HTTP handler uses if-else chains
- **Impact**: Hard to test individual routes, ordering dependencies
- **Suggested Fix**: Convert to table-driven routing like api-handler.ts

### P2 - Medium Priority

#### Cross-feature imports
- **Location**: Various feature modules
- **Description**: Some features import from other features, violating module boundaries
- **Impact**: Tight coupling, harder to understand dependencies
- **Suggested Fix**: Move shared code to core/ or utils/

#### Missing integration tests
- **Location**: `src/core/cli/commands/`
- **Description**: Most commands only have daemon-not-running tests
- **Impact**: No coverage for happy paths
- **Suggested Fix**: Add E2E tests with mock daemon

#### Browser code lacks test coverage
- **Location**: `src/browser/`
- **Description**: Browser-side code has no unit tests
- **Impact**: Regressions caught manually only
- **Suggested Fix**: Add Playwright tests or component tests

### P3 - Low Priority / Future

#### Mixed async patterns
- **Location**: Various files
- **Description**: Some functions use callbacks, some use async/await
- **Impact**: Inconsistency, harder to understand
- **Suggested Fix**: Standardize on async/await

#### Inconsistent error types
- **Location**: Throughout codebase
- **Description**: Mix of `throw new Error`, `throw new CliError`, and return values
- **Impact**: Hard to know how to handle errors
- **Suggested Fix**: See Result type introduction tasks

## Result Type Introduction (Planned)

See tasks Result-P0-1 through Result-P5-19 for comprehensive error handling improvements.

Key items:
- Introduce `Result<T, E>` type
- Define domain error types
- Convert services to use Result
- Standardize error rendering

## Type Strictness Improvements (Planned)

See tasks Type-P0-1 through Type-P6-17 for type system improvements.

Key items:
- Remove unnecessary optional fields
- Define domain boundaries
- Introduce Raw types for external data
- Restrict `?.` and `??` usage to boundaries

### Reducing Optional Chaining (?.) - Ongoing

When modifying files, reduce `?.` usage by:

1. **At domain boundaries**: Add validation, convert to strict types
2. **In domain code**: Use discriminated unions instead of optional fields
3. **In browser code**: Consider state machine patterns for complex state

Priority order:
1. `terminal-client.ts` (75 occurrences) - State machine pattern
2. `BlockManager.ts` (30 occurrences) - Strict block states
3. Protocol types - Raw types + validation

Progress is tracked in `docs/optional-field-inventory.md`

### TypeScript Strictness Settings (Already Enforced)

The tsconfig.json enforces these strict settings:

| Setting | Value | Effect |
|---------|-------|--------|
| `strict` | true | Enables all strict checks |
| `strictNullChecks` | true | No implicit null/undefined |
| `noUncheckedIndexedAccess` | true | Array/object index returns T \| undefined |
| `noImplicitAny` | true | No implicit any types |
| `noImplicitReturns` | true | All code paths must return |
| `noFallthroughCasesInSwitch` | true | Case statements must break |

Biome linting with `"all": true` provides additional safety checks

---

*Last updated: 2026-03-21*
