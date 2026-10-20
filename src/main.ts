import { BahamutClient } from './bahamut.ts';
import { notify } from './notification.ts';

const { BAHAMUT_UID, BAHAMUT_PWD, BAHAMUT_TOTP } = process.env;
if (!BAHAMUT_UID || !BAHAMUT_PWD) {
  console.error('缺少 BAHAMUT_UID 或 BAHAMUT_PWD');
  process.exit(1);
}

const client = new BahamutClient({ uid: BAHAMUT_UID, pwd: BAHAMUT_PWD, totp: BAHAMUT_TOTP });
const results: string[] = [];

try {
  await client.login();
  results.push('✅ 登入成功');
  results.push(await client.signGuild());
} catch (error) {
  results.push(`❌ 錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
}

const failed = results.some(r => r.startsWith('❌'));
console.log(results.join('\n'));
await notify(failed ? '巴哈姆特公會簽到失敗' : '巴哈姆特公會簽到完成', results.join('\n'));

// A red run makes failures visible in the Actions tab and GitHub's failure emails.
if (failed) process.exit(1);
