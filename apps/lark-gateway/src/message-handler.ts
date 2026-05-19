import type { Client } from '@larksuiteoapi/node-sdk';
import type { Config } from './config.js';
import type { LarkMessageEvent, SkillReply } from './types.js';

/**
 * Injectable dependencies. The default wiring lives in `event-router.ts`,
 * which composes the real `dispatchSkill` and `sendReply`. Tests pass in
 * `vi.fn()` mocks so handler logic is exercised without touching the SDK.
 */
export interface HandlerDeps {
  dispatchSkill: (symptom: string, cfg: Config) => Promise<SkillReply>;
  sendReply: (
    client: Client,
    chatId: string,
    messageId: string,
    reply: SkillReply,
  ) => Promise<void>;
}

/**
 * Strip "@username" tokens (e.g. `@_user_1`) and collapse whitespace.
 * Feishu webhook content places the bot mention as a `@_user_N` placeholder
 * keyed against the `mentions[]` array; the raw text contains those tokens
 * verbatim, so removing them yields the user's actual symptom.
 */
export function stripMention(text: string): string {
  return text.replace(/@\S+/g, '').replace(/\s+/g, ' ').trim();
}

export async function handleMessage(
  data: LarkMessageEvent,
  cfg: Config,
  client: Client,
  deps: HandlerDeps,
): Promise<void> {
  if (data.message.message_type !== 'text') return;

  const mentions = data.message.mentions ?? [];
  const isBotMentioned = mentions.some(
    (m) => m.id.open_id === cfg.LARK_BOT_OPEN_ID,
  );
  if (!isBotMentioned) return;

  let rawText = '';
  try {
    const parsed = JSON.parse(data.message.content) as { text?: string };
    rawText = parsed.text ?? '';
  } catch {
    // Malformed content payload — treat as empty so we send help, not crash
    rawText = '';
  }
  const symptom = stripMention(rawText);

  if (symptom.length === 0) {
    await deps.sendReply(
      client,
      data.message.chat_id,
      data.message.message_id,
      {
        kind: 'help',
        text: '@我 + 一句调试症状（如"自动跑点又歪了"），我会生成检查清单。',
      },
    );
    return;
  }

  const reply = await deps.dispatchSkill(symptom, cfg);
  await deps.sendReply(
    client,
    data.message.chat_id,
    data.message.message_id,
    reply,
  );
}
