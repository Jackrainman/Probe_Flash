import type { Config } from './config.js';
import type { SkillReply } from './types.js';

/**
 * Route a parsed debugging symptom to the configured skill provider.
 *
 * MVP: only `mock` is implemented. `claude` / `deepseek` throw to signal
 * that LARK-03 deliberately does not call any real LLM provider — that
 * smoke step belongs to the user (see lark-onboard-guide.md).
 */
export async function dispatchSkill(
  symptom: string,
  cfg: Config,
): Promise<SkillReply> {
  switch (cfg.PROBEFLASH_SKILL_MODE) {
    case 'mock':
      return {
        kind: 'mock',
        text: [
          `[mock 模式] 已收到症状：${symptom}`,
          '',
          'lark-gateway 当前 PROBEFLASH_SKILL_MODE=mock，不调用真实 LLM。',
          '配置 ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY 后，把',
          'PROBEFLASH_SKILL_MODE 改成对应 provider 即可生成 5-8 条检查清单。',
          '详见 docs/research/lark-onboard-guide.md。',
        ].join('\n'),
      };
    case 'claude':
      throw new Error(
        'claude mode is not implemented in MVP; configure ANTHROPIC_API_KEY and add a provider call in a follow-up task',
      );
    case 'deepseek':
      throw new Error(
        'deepseek mode is not implemented in MVP; configure DEEPSEEK_API_KEY and add a provider call in a follow-up task',
      );
  }
}
