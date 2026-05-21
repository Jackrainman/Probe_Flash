import * as lark from '@larksuiteoapi/node-sdk';
import type { Toolkit } from '@probeflash/lark-toolkit';
import type { SkillDispatcher } from '@probeflash/pf-skills';
import type { Config } from './config.js';
import type { LarkMessageEvent } from './types.js';
import { handleMessage } from './message-handler.js';
import { logger } from './logger.js';

/**
 * Wire `im.message.receive_v1` events to `handleMessage` with the
 * caller-provided toolkit + skill dispatcher. Exceptions are swallowed
 * (logged) so they cannot bubble up and close the WS connection.
 */
export function buildEventDispatcher(
  cfg: Config,
  toolkit: Toolkit,
  skills: SkillDispatcher,
): lark.EventDispatcher {
  return new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data: LarkMessageEvent) => {
      try {
        await handleMessage(data, cfg, { toolkit, skills });
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
