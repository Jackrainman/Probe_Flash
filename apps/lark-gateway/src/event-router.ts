import * as lark from '@larksuiteoapi/node-sdk';
import type { Client } from '@larksuiteoapi/node-sdk';
import type { Config } from './config.js';
import type { LarkMessageEvent } from './types.js';
import { handleMessage } from './message-handler.js';
import { dispatchSkill } from './skill-dispatcher.js';
import { sendReply } from './reply-sender.js';
import { logger } from './logger.js';

/**
 * Wire `im.message.receive_v1` events to `handleMessage` with the real
 * `dispatchSkill` + `sendReply` dependencies. Exceptions inside the
 * handler are swallowed (logged) so they cannot bubble up and crash
 * the SDK's WebSocket loop — which would silently take the bot offline
 * mid-session.
 */
export function buildEventDispatcher(
  cfg: Config,
  client: Client,
): lark.EventDispatcher {
  return new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data: LarkMessageEvent) => {
      try {
        await handleMessage(data, cfg, client, { dispatchSkill, sendReply });
      } catch (err) {
        logger.error('handler error', {
          chat_id: data?.message?.chat_id,
          message_id: data?.message?.message_id,
          error: (err as Error).message,
        });
      }
      return { ok: true };
    },
  });
}
