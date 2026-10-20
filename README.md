# Bahamut Daily Bonus Action

GitHub Actions companion to [bahamut-daily-bonus-worker](https://github.com/7a6163/bahamut-daily-bonus-worker).

The Worker handles the main site sign-in (主站簽到). Some Bahamut endpoints block Cloudflare Worker IPs but accept GitHub Actions runners, so this repo runs those rewards instead.

| Reward | Status |
|---|---|
| Guild sign-in (公會簽到) | ✅ `daily` workflow, 08:17 Taiwan time |
| Ad double reward (廣告雙倍獎勵) | 🔬 being probed by the `spike` workflow |
| Ani Gamer quiz (動畫瘋答題) | ❌ blocked by a Cloudflare challenge on runners too |

## Setup

Set the repository secrets:

```bash
gh secret set BAHAMUT_UID
gh secret set BAHAMUT_PWD
gh secret set BAHAMUT_TOTP          # optional: the 16-char TOTP secret, not a 6-digit code
gh secret set TELEGRAM_BOT_TOKEN    # optional
gh secret set TELEGRAM_CHAT_ID      # optional
```

## Daily workflow

Runs on a cron (GitHub may start it late) or manually with `gh workflow run daily`. It sends a Telegram message titled 巴哈姆特公會簽到 and fails the run if any step reports ❌. A `keepalive` job re-enables the workflow through the API so the 60-day inactivity rule for public repos doesn't switch it off.

## Spike

```bash
gh workflow run spike
gh run watch
```

Run it after 08:00 Taiwan time so the Worker has already done the main sign-in, which the ad double reward depends on.

The repo is public, so logs contain only status codes, Cloudflare challenge detection, and response previews truncated to 120 characters. Cookie values and tokens are never printed.

Locally (requires Node 24+, which runs TypeScript directly):

```bash
npm ci
BAHAMUT_UID=... BAHAMUT_PWD=... npm start      # daily run
BAHAMUT_UID=... BAHAMUT_PWD=... npm run spike  # probes
npm run typecheck
```

## License

MIT
