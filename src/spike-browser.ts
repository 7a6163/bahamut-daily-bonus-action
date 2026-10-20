// Probe whether a headed Chromium (under Xvfb) gets past the Cloudflare challenge on
// ani.gamer.com.tw from a GitHub Actions runner. Public repo: never log cookies or tokens.
import { chromium } from 'playwright';
import { BahamutClient } from './bahamut.ts';

const ORIGIN = 'https://ani.gamer.com.tw/';
const CHALLENGE_TITLE = /Just a moment|請稍候|Attention Required/i;

const client = new BahamutClient({
  uid: process.env.BAHAMUT_UID!,
  pwd: process.env.BAHAMUT_PWD!,
  totp: process.env.BAHAMUT_TOTP
});
await client.login();
console.log('[login] ok');

const headless = process.env.HEADLESS === '1';
const browser = await chromium.launch({ headless, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
console.log(`[browser] chromium ${browser.version()} headless=${headless}`);

try {
  const context = await browser.newContext({ locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
  await context.addCookies(client.exportCookies().map(c => ({ ...c, domain: '.gamer.com.tw', path: '/' })));
  const page = await context.newPage();

  const started = Date.now();
  const res = await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
  const firstTitle = await page.title();
  console.log(`[goto] status=${res?.status()} title=${firstTitle.slice(0, 60)} challenge=${CHALLENGE_TITLE.test(firstTitle)}`);

  // Wait for the challenge to clear: the title changes once Cloudflare lets the page through.
  let cleared = !CHALLENGE_TITLE.test(firstTitle);
  while (!cleared && Date.now() - started < 45000) {
    await page.waitForTimeout(1000);
    cleared = !CHALLENGE_TITLE.test(await page.title().catch(() => ''));
  }
  const hasClearance = (await context.cookies(ORIGIN)).some(c => c.name === 'cf_clearance');
  console.log(`[challenge] cleared=${cleared} after=${Date.now() - started}ms cf_clearance=${hasClearance} title=${(await page.title()).slice(0, 60)}`);

  const question = await page.evaluate(async url => {
    const r = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    return { status: r.status, text: await r.text() };
  }, `${ORIGIN}ajax/animeGetQuestion.php?t=${Date.now()}`);
  console.log(`[anime-question] status=${question.status} body=${question.text.slice(0, 120).replace(/\s+/g, ' ')}`);
} finally {
  await browser.close();
}
