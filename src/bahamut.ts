import { TOTP } from 'otpauth';

export interface Credentials {
  uid: string;
  pwd: string;
  totp?: string;
}

// The repo is public: never log cookie values, tokens or raw login responses.
export class BahamutClient {
  private cookies = new Map<string, string>();
  private headers = {
    'User-Agent': 'Bahamut/5.0 CFNetwork/1399 Darwin/22.1.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  private credentials: Credentials;

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  private async smartDelay(baseMs = 500): Promise<void> {
    const delay = Math.min(baseMs + Math.floor(Math.random() * 500), 2000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private absorb(res: Response): void {
    for (const cookie of res.headers.getSetCookie()) {
      const [nameValue] = cookie.split(';');
      const i = nameValue.indexOf('=');
      if (i > 0) this.cookies.set(nameValue.slice(0, i).trim(), nameValue.slice(i + 1).trim());
    }
  }

  // For handing the login session to a browser context.
  exportCookies(): { name: string; value: string }[] {
    return Array.from(this.cookies, ([name, value]) => ({ name, value }));
  }

  private cookieString(): string {
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`).join('; ');
  }

  async login(retry = 3): Promise<void> {
    for (let i = 0; i < retry; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));

      const body = new URLSearchParams({ uid: this.credentials.uid, passwd: this.credentials.pwd, vcode: '6666' });
      if (this.credentials.totp) {
        body.append('twoStepAuth', new TOTP({ secret: this.credentials.totp, algorithm: 'SHA1', digits: 6, period: 30 }).generate());
      }

      const res = await fetch('https://api.gamer.com.tw/mobile_app/user/v3/do_login.php', {
        method: 'POST',
        headers: { ...this.headers, Cookie: 'ckAPP_VCODE=6666' },
        body
      });
      this.absorb(res);
      this.cookies.set('ckAPP_VCODE', '6666');

      const data: { success?: boolean; message?: string } = await res.json();
      if (data.success) return;

      if (data.message?.includes('查無此人')) throw new Error('帳號不存在');
      if (data.message?.includes('帳號、密碼')) throw new Error('密碼錯誤');
      if (data.message?.includes('驗證碼錯誤')) continue;
    }
    throw new Error('登入失敗，已達重試次數上限');
  }

  async signGuild(): Promise<string> {
    try {
      await this.smartDelay(600);

      const listRes = await fetch('https://api.gamer.com.tw/ajax/common/topBar.php?type=forum', {
        headers: { ...this.headers, Cookie: this.cookieString() }
      });
      const guildId = (await listRes.text()).match(/guild\.php\?g?sn=(\d+)/)?.[1];
      if (!guildId) return '⚠️ 未加入任何公會';

      await this.smartDelay(400);

      const signRes = await fetch('https://guild.gamer.com.tw/ajax/guildSign.php', {
        method: 'POST',
        headers: { ...this.headers, Cookie: this.cookieString(), Referer: `https://guild.gamer.com.tw/${guildId}` },
        body: `sn=${guildId}`
      });
      const text = await signRes.text();

      let result: { ok?: number; error?: number; msg?: string };
      try {
        result = JSON.parse(text);
      } catch {
        return `❌ 公會簽到失敗: 非 JSON 回應 (${signRes.status})`;
      }

      if (result.ok === 1) return `✅ 公會簽到成功${result.msg ? `：${result.msg}` : ''}`;
      if (result.msg?.includes('已經簽到過了') || result.msg?.includes('已簽到')) return '⚠️ 公會今日已簽到';
      if (result.msg) return `❌ 公會簽到失敗: ${result.msg}`;
      return '❌ 公會簽到失敗: 未知錯誤';
    } catch (error) {
      return `❌ 公會簽到失敗: ${error instanceof Error ? error.message : '未知錯誤'}`;
    }
  }
}
