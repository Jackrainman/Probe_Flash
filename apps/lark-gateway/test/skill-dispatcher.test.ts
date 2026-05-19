import { describe, test, expect, vi } from 'vitest';
import { dispatchSkill } from '../src/skill-dispatcher';
import type { Config } from '../src/config';

function makeCfg(mode: Config['PROBEFLASH_SKILL_MODE']): Config {
  return {
    LARK_APP_ID: 'app',
    LARK_APP_SECRET: 'secret',
    LARK_BOT_OPEN_ID: 'ou_bot',
    LARK_DOMAIN: 'feishu',
    PROBEFLASH_SKILL_MODE: mode,
  };
}

describe('dispatchSkill', () => {
  test('mock mode returns kind="mock" and includes the symptom verbatim', async () => {
    const reply = await dispatchSkill('自动跑点又歪了', makeCfg('mock'));
    expect(reply.kind).toBe('mock');
    expect(reply.text).toContain('自动跑点又歪了');
  });

  test('mock mode mentions PROBEFLASH_SKILL_MODE for user discovery', async () => {
    const reply = await dispatchSkill('CAN 总线偶发丢帧', makeCfg('mock'));
    expect(reply.text).toContain('PROBEFLASH_SKILL_MODE');
  });

  test('mock mode mentions onboard-guide path', async () => {
    const reply = await dispatchSkill('test', makeCfg('mock'));
    expect(reply.text).toContain('lark-onboard-guide.md');
  });

  test('claude mode throws (not implemented in MVP)', async () => {
    await expect(dispatchSkill('test', makeCfg('claude'))).rejects.toThrow(
      /not implemented/i,
    );
  });

  test('deepseek mode throws (not implemented in MVP)', async () => {
    await expect(dispatchSkill('test', makeCfg('deepseek'))).rejects.toThrow(
      /not implemented/i,
    );
  });
});
