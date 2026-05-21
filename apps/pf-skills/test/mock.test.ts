import { describe, test, expect } from 'vitest';
import { mockChecklist } from '../src/debug-checklist/mock';

describe('mockChecklist', () => {
  test('返回 kind=mock 且文案含症状原文', () => {
    const reply = mockChecklist('自动跑点又歪了');
    expect(reply.kind).toBe('mock');
    expect(reply.text).toContain('[mock 模式] 已收到症状：自动跑点又歪了');
  });

  test('文案含 PROBEFLASH_SKILL_MODE / provider key 指引', () => {
    const reply = mockChecklist('x');
    expect(reply.text).toContain('mode=mock');
    expect(reply.text).toContain('ANTHROPIC_API_KEY');
    expect(reply.text).toContain('DEEPSEEK_API_KEY');
    expect(reply.text).toContain('docs/research/lark-onboard-guide.md');
  });

  test('多行用 \\n 拼接（与原 lark-gateway/skill-dispatcher.ts 一致）', () => {
    const reply = mockChecklist('x');
    expect(reply.text.split('\n').length).toBeGreaterThanOrEqual(5);
  });
});
