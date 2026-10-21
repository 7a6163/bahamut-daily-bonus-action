import { BahamutClient } from './bahamut.ts';
import { notify } from './notification.ts';

const { BAHAMUT_UID, BAHAMUT_PWD, BAHAMUT_TOTP } = process.env;
if (!BAHAMUT_UID || !BAHAMUT_PWD) {
  console.error('缺少 BAHAMUT_UID 或 BAHAMUT_PWD');
  process.exit(1);
}

const client = new BahamutClient({ uid: BAHAMUT_UID, pwd: BAHAMUT_PWD, totp: BAHAMUT_TOTP });
const rewards: string[] = [];

try {
  await client.login();
  rewards.push(await client.signMain());
  rewards.push(await client.signAds());
  rewards.push(await client.signGuild());
} catch (error) {
  rewards.push(`❌ 登入失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
}

const failed = rewards.some(r => r.startsWith('❌'));
const message = rewards.join('\n');
console.log(message);

// The workflow runs several times a day; later runs only see ⚠️ (already done), so stay quiet then.
if (rewards.some(r => r.startsWith('✅') || r.startsWith('❌'))) {
  await notify(failed ? '巴哈姆特每日簽到失敗' : '巴哈姆特每日簽到完成', message);
}

// A red run makes failures visible in the Actions tab and GitHub's failure emails.
if (failed) process.exit(1);
