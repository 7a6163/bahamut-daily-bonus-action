// Sends a Telegram message when both secrets are set; never throws.
export async function notify(title: string, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const escape = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🎮 *${escape(title)}*\n\n${escape(message)}`,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      })
    });
    if (!res.ok) console.error(`Telegram API error: status=${res.status}`);
  } catch (error) {
    console.error('Failed to send notification:', error instanceof Error ? error.message : error);
  }
}
