# Testing Guide

## Recommended command order

Run this for daily/local verification:

```bash
npm run test:all:stable
```

This command does:
1. `test:preflight`: check `.env` and Supabase DNS reachability
2. `test:run`: run Vitest tests
3. `test:e2e:stable`: run Playwright E2E with `--workers=2`

## Why `stable`

E2E tests create users and sign in many times. High parallelism can trigger Supabase Auth rate limits.
Using `--workers=2` reduces flaky failures while keeping acceptable speed.

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

## CI suggestion

For CI/local consistency, prefer:

```bash
npm run test:all:stable
```

If you need max speed and can accept occasional flakes:

```bash
npm run test:e2e
```
