import type { Client } from '@larksuiteoapi/node-sdk';
import type { SkillReply } from './types.js';
import { logger } from './logger.js';

/**
 * Send a plain-text reply back to the originating chat.
 *
 * MVP scope: plain text only, no thread / no card. `replyToMessageId` is
 * accepted but not yet wired — it stays in the signature so callers don't
 * change when we later switch to `reply_in_thread` or interactive cards.
 *
 * Errors are caught here (single retry) and logged; we never re-throw out
 * of the handler chain because that would close the WS connection.
 */
export async function sendReply(
  client: Client,
  chatId: string,
  replyToMessageId: string,
  reply: SkillReply,
): Promise<void> {
  void replyToMessageId; // reserved for future thread / reply_in_thread

  const payload = {
    params: { receive_id_type: 'chat_id' as const },
    data: {
      receive_id: chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: reply.text }),
    },
  };

  try {
    await client.im.v1.message.create(payload);
  } catch (err) {
    logger.warn('first send attempt failed, retrying once', {
      chat_id: chatId,
      reply_kind: reply.kind,
      error: (err as Error).message,
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await client.im.v1.message.create(payload);
    } catch (err2) {
      logger.error('retry also failed, dropping reply', {
        chat_id: chatId,
        reply_kind: reply.kind,
        error: (err2 as Error).message,
      });
    }
  }
}
