# 巴哈姆特每日簽到 Action

> Daily Bahamut (gamer.com.tw) sign-in, ad double reward and guild sign-in on GitHub Actions, with Telegram notifications.

用 GitHub Actions 每天自動領取巴哈姆特的例行獎勵，不需要自己的伺服器。

| 獎勵 | 支援 |
|---|---|
| 主站簽到 | ✅ |
| 廣告雙倍獎勵 | ✅（主站簽到完成後才會領取） |
| 公會簽到 | ✅（沒加入公會會顯示 ⚠️，不算失敗） |
| 動畫瘋答題 | ❌ `ani.gamer.com.tw` 封鎖所有機房 IP（包含 GitHub Actions），只能從家用網路執行 |

## 使用方式

### 1. 建立自己的 repo

在這個 repo 頁面按 **Use this template → Create a new repository**，建議選 **Private**：

- 私有 repo 的執行紀錄不會公開
- 私有 repo 每月有 2000 分鐘免費額度，每天三次大約只用 135 分鐘

請不要用 fork：fork 的 Actions 預設停用，而且一定是公開的。

### 2. 設定 Secrets

到你的 repo 的 **Settings → Secrets and variables → Actions → New repository secret** 新增：

| 名稱 | 必填 | 說明 |
|---|---|---|
| `BAHAMUT_UID` | ✅ | 巴哈姆特帳號 |
| `BAHAMUT_PWD` | ✅ | 巴哈姆特密碼 |
| `BAHAMUT_TOTP` | | 有開兩步驟驗證才需要：16 碼的 TOTP 金鑰（設定驗證器時的那串文字），不是 6 位數驗證碼 |
| `TELEGRAM_BOT_TOKEN` | | Telegram 通知用，向 [@BotFather](https://t.me/botfather) 申請 |
| `TELEGRAM_CHAT_ID` | | Telegram 通知用，可傳訊息給 [@userinfobot](https://t.me/userinfobot) 取得 |

或使用 GitHub CLI：

```bash
gh secret set BAHAMUT_UID
gh secret set BAHAMUT_PWD
gh secret set BAHAMUT_TOTP
gh secret set TELEGRAM_BOT_TOKEN
gh secret set TELEGRAM_CHAT_ID
```

### 3. 手動跑一次確認

到 **Actions → daily → Run workflow**，或執行 `gh workflow run daily`。

## 運作方式

- **每天執行三次**：台灣時間 08:17、12:17、20:17。GitHub 的排程可能延遲甚至跳過，後面的執行會補上漏掉的獎勵；已經領過的只會回報 ⚠️。
- **Telegram 通知**：只有出現 ✅（這次有領到）或 ❌（失敗）時才通知，全部都是 ⚠️（今天已完成）就不打擾。
- **失敗時**：這次執行會標成失敗，GitHub 也會寄通知信給你。
- **保持啟用**：GitHub 會停用 60 天沒有活動的 repo 的排程，`keepalive` job 每次執行時會透過 API 重新啟用。

## 本機開發

需要 Node 24 以上（可直接執行 TypeScript）。

```bash
npm ci
BAHAMUT_UID=... BAHAMUT_PWD=... npm start
npm run typecheck
```

執行紀錄可能公開，所以程式不會輸出 cookie、token 或登入回應。

## License

MIT
