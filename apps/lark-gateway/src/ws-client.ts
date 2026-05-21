import * as lark from '@larksuiteoapi/node-sdk';
import type { Config } from './config.js';

/**
 * Build only the inbound WSClient. Outbound SDK Client now lives in
 * `@probeflash/lark-toolkit` and is created independently with its own
 * (subset) config.
 */
export function createWsClient(cfg: Config): lark.WSClient {
  return new lark.WSClient({
    appId: cfg.LARK_APP_ID,
    appSecret: cfg.LARK_APP_SECRET,
    domain: cfg.LARK_DOMAIN === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.info,
  });
}
