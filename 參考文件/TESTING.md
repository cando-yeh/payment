# Testing Guide

## Recommended command order

Run this for daily/local verification:

```bash
npm run test:all:stable
```

For database cleanup only:

```bash
npm run test:cleanup
```

This command does:
1. `test:preflight`: check `.env` and Supabase DNS reachability
2. `test:run`: run Vitest tests
3. `test:e2e:stable`: run Playwright E2E with `--workers=2`

Latest baseline (2026-02-20):
- `npm run check`: pass
- `npm run test:run`: pass
- E2E baseline is maintained by `npm run test:e2e:stable`

## Why `stable`

E2E tests create users and sign in many times. High parallelism can trigger Supabase Auth rate limits.
Using `--workers=2` reduces flaky failures while keeping acceptable speed.

## Test data policy (required)

1. Test users must use `@example.com` email suffix.
2. Test payee/claim names should include `E2E` or `Test`.
3. Never create test data without a recognizable marker.
4. Playwright now runs global teardown (`tests/global-teardown.ts`) and always executes `cleanup-test-data` after suite completion.
5. If a run is interrupted, manually run `npm run test:cleanup`.

## Common failures and handling

### `ENOTFOUND <project>.supabase.co`
- Cause: network DNS cannot resolve Supabase host.
- Action: run `npm run test:preflight` first; switch network/VPN if needed.

### `Request rate limit reached`
- Cause: too many auth requests in parallel.
- Action: use `npm run test:e2e:stable` instead of `npm run test:e2e`.

### UI text assertion failures
- Cause: text changes or i18n wording updates.
- Action: prefer `data-testid` selectors for critical actions/dialogs.

### Schema mismatch after migration changes
- Cause: test DB not yet migrated to latest columns.
- Action: apply the consolidated migration before running e2e:
  - `supabase/migrations/20260220012000_consolidate_current_schema.sql`

## CI suggestion

For CI/local consistency, prefer:

```bash
npm run test:all:stable
```

If you need max speed and can accept occasional flakes:

```bash
npm run test:e2e
```
