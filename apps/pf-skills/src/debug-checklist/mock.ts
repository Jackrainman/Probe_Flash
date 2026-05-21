import type { SkillReply } from '../types.js';

export function mockChecklist(symptom: string): SkillReply {
  return {
    kind: 'mock',
    text: [
      `[mock 模式] 已收到症状：${symptom}`,
      '',
      'pf-skills 当前 mode=mock，不调用真实 LLM。',
      '配置 ANTHROPIC_API_KEY 或 DEEPSEEK_API_KEY 后，把',
      'mode 改成对应 provider 即可生成 5-8 条检查清单。',
      '详见 docs/research/lark-onboard-guide.md。',
    ].join('\n'),
  };
}
