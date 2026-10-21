import { randomBytes } from 'node:crypto';
import { TOTP } from 'otpauth';

export interface Credentials {
  uid: string;
  pwd: string;
  totp?: string;
}

// The repo is public: never log cookie values, tokens or raw login responses.
export class BahamutClient {
  private cookies = new Map<string, string>();
  private csrfToken = '';
  private mainSignedIn = false;
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

  async signMain(): Promise<string> {
    try {
      await this.smartDelay(800);

      // The web sign-in sits behind a Cloudflare challenge; the mobile endpoint only needs the login cookie.
      const res = await fetch('https://api.gamer.com.tw/mobile_app/bahamut/v1/sign_in.php', {
        method: 'POST',
        headers: { ...this.headers, Cookie: this.cookieString() },
        body: 'vcode=6666'
      });
      this.absorb(res);
      const text = await res.text();

      let data: {
        token?: string;
        bahamutCsrfToken?: string;
        message?: string;
        data?: { days?: number; token?: string; bahamutCsrfToken?: string };
        error?: { message?: string };
      };
      try {
        data = JSON.parse(text);
      } catch {
        return `❌ 主站簽到失敗: 非 JSON 回應 (${res.status})`;
      }

      const token = data.token || data.bahamutCsrfToken || data.data?.token || data.data?.bahamutCsrfToken;
      if (token) this.csrfToken = token;

      if (data.data?.days != null) {
        this.mainSignedIn = true;
        return `✅ 主站簽到成功，已連續簽到 ${data.data.days} 天`;
      }

      const msg = data.message || data.error?.message;
      if (msg?.includes('簽到成功')) {
        this.mainSignedIn = true;
        return '✅ 主站簽到成功';
      }
      if (msg?.includes('已經簽到') || msg?.includes('已簽到')) {
        this.mainSignedIn = true;
        return '⚠️ 主站今日已簽到';
      }
      return `❌ 主站簽到失敗: ${msg || '未知錯誤'}`;
    } catch (error) {
      return `❌ 主站簽到失敗: ${error instanceof Error ? error.message : '未知錯誤'}`;
    }
  }

  async signAds(): Promise<string> {
    if (!this.mainSignedIn) return '⚠️ 略過廣告雙倍獎勵：主站簽到未完成';

    try {
      // The ad endpoints only check that the bahamutCsrfToken param matches the
      // ckBahamutCsrfToken cookie (double-submit), so a random token works when
      // the sign-in didn't issue one.
      const token = this.csrfToken || this.cookies.get('ckBahamutCsrfToken') || randomBytes(8).toString('hex');
      const call = async (step: 'start' | 'finished') => {
        const res = await fetch(`https://api.gamer.com.tw/mobile_app/bahamut/v1/sign_in_ad_${step}.php?bahamutCsrfToken=${token}`, {
          method: 'POST',
          headers: { ...this.headers, Cookie: `ckBahamutCsrfToken=${token}; ${this.cookieString()}` }
        });
        return await res.json() as { data?: { finished?: number }; message?: string; error?: { message?: string } };
      };

      await this.smartDelay(500);
      const start = await call('start');
      if (start.data?.finished === 1) return '⚠️ 廣告雙倍獎勵今日已領取';
      if (start.data?.finished !== 0) {
        return `❌ 廣告雙倍獎勵啟動失敗: ${start.error?.message || start.message || '未知錯誤'}`;
      }

      // The app requires the ad to have "played" before claiming.
      await new Promise(resolve => setTimeout(resolve, 30000));

      const finish = await call('finished');
      if (finish.data?.finished === 1) return '✅ 廣告雙倍獎勵領取成功';
      return `❌ 廣告雙倍獎勵領取失敗: ${finish.error?.message || finish.message || '未知錯誤'}`;
    } catch (error) {
      return `❌ 廣告雙倍獎勵失敗: ${error instanceof Error ? error.message : '未知錯誤'}`;
    }
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
