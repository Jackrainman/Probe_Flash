import * as lark from '@larksuiteoapi/node-sdk';
import type { Config } from './config.js';

/**
 * Build the two Lark SDK clients we need:
 *   - `client`   — used for outbound API calls (sending messages back)
 *   - `wsClient` — used for inbound events over WebSocket Long Connection
 *
 * The SDK manages `tenant_access_token` lifetime, retries, heartbeat, and
 * reconnect internally; we just hand it the four credentials and let it run.
 */
export function createLarkClients(cfg: Config): {
  client: lark.Client;
  wsClient: lark.WSClient;
} {
  const baseConfig = {
    appId: cfg.LARK_APP_ID,
    appSecret: cfg.LARK_APP_SECRET,
    domain:
      cfg.LARK_DOMAIN === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
  };

  const client = new lark.Client({
    ...baseConfig,
    appType: lark.AppType.SelfBuild,
  });

  const wsClient = new lark.WSClient({
    ...baseConfig,
    loggerLevel: lark.LoggerLevel.info,
  });

  return { client, wsClient };
}
