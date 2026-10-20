// Probe which Bahamut endpoints are reachable from a GitHub Actions runner.
// The repo is public, so logs must never contain cookie values or tokens.
import { randomBytes } from 'node:crypto';
import { TOTP } from 'otpauth';

const UA = 'Bahamut/5.0 CFNetwork/1399 Darwin/22.1.0';
const HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Content-Type': 'application/x-www-form-urlencoded'
};

const cookies = new Map<string, string>();

function absorb(res: Response): void {
  for (const c of res.headers.getSetCookie()) {
    const [nameValue] = c.split(';');
    const i = nameValue.indexOf('=');
    if (i > 0) cookies.set(nameValue.slice(0, i).trim(), nameValue.slice(i + 1).trim());
  }
}

function cookieString(extra: Record<string, string> = {}): string {
  return [...cookies, ...Object.entries(extra)].map(([k, v]) => `${k}=${v}`).join('; ');
}

// Summarise a response without leaking secrets: status, challenge marker, short preview.
async function report(label: string, res: Response, showBody = true): Promise<string> {
  const text = await res.text();
  const challenged = res.headers.get('cf-mitigated') === 'challenge' || /Just a moment|cf-chl/i.test(text);
  const preview = showBody ? text.slice(0, 120).replace(/\s+/g, ' ') : `(${text.length} chars hidden)`;
  console.log(`[${label}] status=${res.status} challenge=${challenged} body=${preview}`);
  return text;
}

function parse(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

async function login(): Promise<void> {
  const body = new URLSearchParams({ uid: process.env.BAHAMUT_UID!, passwd: process.env.BAHAMUT_PWD!, vcode: '6666' });
  if (process.env.BAHAMUT_TOTP) {
    body.append('twoStepAuth', new TOTP({ secret: process.env.BAHAMUT_TOTP, algorithm: 'SHA1', digits: 6, period: 30 }).generate());
  }
  const res = await fetch('https://api.gamer.com.tw/mobile_app/user/v3/do_login.php', {
    method: 'POST',
    headers: { ...HEADERS, Cookie: 'ckAPP_VCODE=6666' },
    body
  });
  absorb(res);
  cookies.set('ckAPP_VCODE', '6666');
  const data = parse(await report('login', res, false));
  console.log(`[login] success=${data?.success} message=${data?.message ?? ''}`);
  if (!data?.success) throw new Error('login failed');
}

async function probeGuild(): Promise<void> {
  const list = await fetch('https://api.gamer.com.tw/ajax/common/topBar.php?type=forum', {
    headers: { ...HEADERS, Cookie: cookieString() }
  });
  const html = await report('guild-list', list, false);
  const sn = html.match(/guild\.php\?g?sn=(\d+)/)?.[1];
  console.log(`[guild-list] guildFound=${Boolean(sn)}`);
  if (!sn) return;

  const res = await fetch('https://guild.gamer.com.tw/ajax/guildSign.php', {
    method: 'POST',
    headers: { ...HEADERS, Cookie: cookieString(), Referer: `https://guild.gamer.com.tw/${sn}` },
    body: `sn=${sn}`
  });
  await report('guild-sign', res);
}

async function probeAnime(): Promise<void> {
  const res = await fetch(`https://ani.gamer.com.tw/ajax/animeGetQuestion.php?t=${Date.now()}`, {
    headers: {
      'User-Agent': 'Anime/2.13.9 (tw.com.gamer.anime;build:437;iOS 14.5.0) Alamofire/5.4.1',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      Cookie: cookieString(),
      Referer: 'https://ani.gamer.com.tw/',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  await report('anime-question', res);
}

async function probeWebCsrf(): Promise<string | null> {
  const res = await fetch('https://www.gamer.com.tw/ajax/get_csrf_token.php', {
    headers: { ...HEADERS, Cookie: cookieString(), Referer: 'https://www.gamer.com.tw/' }
  });
  const text = await report('web-csrf', res, false);
  return res.ok && /^[0-9a-f]{16,}$/i.test(text.trim()) ? text.trim().slice(0, 16) : null;
}

// Returns true once the ad reward has been claimed (or was already claimed).
async function tryAds(label: string, token: string): Promise<boolean> {
  const call = async (step: string) => {
    const res = await fetch(`https://api.gamer.com.tw/mobile_app/bahamut/v1/sign_in_ad_${step}.php?bahamutCsrfToken=${token}`, {
      method: 'POST',
      headers: { ...HEADERS, Cookie: cookieString({ ckBahamutCsrfToken: token }) }
    });
    return parse(await report(`${label}-${step}`, res));
  };

  const start = await call('start');
  if (start?.data?.finished === 1) return true;
  if (start?.data?.finished !== 0) return false;
  await new Promise(r => setTimeout(r, 30000));
  const finish = await call('finished');
  return finish?.data?.finished === 1;
}

async function step(name: string, fn: () => Promise<unknown>): Promise<void> {
  try { await fn(); } catch (e) { console.log(`[${name}] threw ${e instanceof Error ? e.message : e}`); }
}

await login();
await step('guild', probeGuild);
await step('anime', probeAnime);
await step('ads', async () => {
  // Hypothesis (a): the CSRF check is double-submit, so any token matching the cookie works.
  if (await tryAds('ads-random', randomBytes(8).toString('hex'))) {
    console.log('[ads] random token works');
    return;
  }
  // Hypothesis (b): a server-issued token from the web endpoint is required.
  const webToken = await probeWebCsrf();
  if (webToken && await tryAds('ads-web', webToken)) console.log('[ads] web token works');
});
