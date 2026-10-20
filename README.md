# Bahamut Daily Bonus Action

GitHub Actions companion to [bahamut-daily-bonus-worker](https://github.com/7a6163/bahamut-daily-bonus-worker).

The Worker handles the main site sign-in (主站簽到). Some Bahamut endpoints block Cloudflare Worker requests, so this repo tries to run the remaining rewards from a GitHub Actions runner instead:

- Guild sign-in (公會簽到)
- Ani Gamer quiz (動畫瘋答題)
- Ad double reward (廣告雙倍獎勵)

> **Status: spike.** `src/spike.ts` only probes whether these endpoints are reachable from a runner. The real workflow will be built based on its results.

## Setup

Set the repository secrets:

```bash
gh secret set BAHAMUT_UID
gh secret set BAHAMUT_PWD
gh secret set BAHAMUT_TOTP   # optional: the 16-char TOTP secret, not a 6-digit code
```

## Run the spike

```bash
gh workflow run spike
gh run watch
```

Run it after 08:00 Taiwan time so the Worker has already done the main sign-in, which the ad double reward depends on.

The repo is public, so the spike logs only status codes, Cloudflare challenge detection, and response previews truncated to 120 characters. Cookie values and tokens are never printed.

Locally (requires Node 24+, which runs TypeScript directly):

```bash
npm ci
BAHAMUT_UID=... BAHAMUT_PWD=... npm run spike
npm run typecheck
```

## License

MIT
