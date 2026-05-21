import 'dotenv/config';
import { createToolkit } from '@probeflash/lark-toolkit';
import { createSkillDispatcher } from '@probeflash/pf-skills';
import { loadConfig } from './config.js';
import { createWsClient } from './ws-client.js';
import { buildEventDispatcher } from './event-router.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const wsClient = createWsClient(cfg);
  const toolkit = createToolkit({
    larkAppId: cfg.LARK_APP_ID,
    larkAppSecret: cfg.LARK_APP_SECRET,
    larkDomain: cfg.LARK_DOMAIN,
  });
  const skills = createSkillDispatcher({ mode: cfg.PROBEFLASH_SKILL_MODE });
  const eventDispatcher = buildEventDispatcher(cfg, toolkit, skills);

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
