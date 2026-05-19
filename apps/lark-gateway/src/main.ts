import 'dotenv/config';
import { loadConfig } from './config.js';
import { createLarkClients } from './lark-client.js';
import { buildEventDispatcher } from './event-router.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { client, wsClient } = createLarkClients(cfg);
  const eventDispatcher = buildEventDispatcher(cfg, client);

  logger.info('starting lark-gateway', {
    domain: cfg.LARK_DOMAIN,
    mode: cfg.PROBEFLASH_SKILL_MODE,
    bot_open_id: cfg.LARK_BOT_OPEN_ID,
  });

  wsClient.start({ eventDispatcher });
}

main().catch((err) => {
  logger.error('fatal', { error: (err as Error).message });
  process.exit(1);
});
