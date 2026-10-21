# Bahamut Daily Bonus Action

GitHub Actions companion to [bahamut-daily-bonus-worker](https://github.com/7a6163/bahamut-daily-bonus-worker).

`guild.gamer.com.tw` blocks Cloudflare Worker IPs but accepts GitHub Actions runners, so guild sign-in runs here while everything else stays in the Worker.

| Reward | Where |
|---|---|
| Main site sign-in (主站簽到) | Worker |
| Ad double reward (廣告雙倍獎勵) | Worker |
| Guild sign-in (公會簽到) | ✅ this repo, `daily` workflow, 08:17 Taiwan time |
| Ani Gamer quiz (動畫瘋答題) | ❌ not automated: `ani.gamer.com.tw` returns 403 to datacenter IPs (Workers, GitHub runners, even a real headed browser) and only works from residential IPs |

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

## Development

The repo is public, so logs never contain cookie values, tokens or raw login responses.

Locally (requires Node 24+, which runs TypeScript directly):

```bash
npm ci
BAHAMUT_UID=... BAHAMUT_PWD=... npm start
npm run typecheck
```

## License

MIT
