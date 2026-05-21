import { describe, test, expect } from 'vitest';
import { createSkillDispatcher } from '../src/index';

describe('createSkillDispatcher', () => {
  test('mode=mock → dispatch 返回 mockChecklist 输出', async () => {
    const dispatcher = createSkillDispatcher({ mode: 'mock' });
    const reply = await dispatcher.dispatch('自动跑点又歪了');
    expect(reply.kind).toBe('mock');
    expect(reply.text).toContain('自动跑点又歪了');
  });

  test('mode=claude → dispatch throws not-implemented', async () => {
    const dispatcher = createSkillDispatcher({ mode: 'claude' });
    await expect(dispatcher.dispatch('x')).rejects.toThrow(/ANTHROPIC/);
  });

  test('mode=deepseek → dispatch throws not-implemented', async () => {
    const dispatcher = createSkillDispatcher({ mode: 'deepseek' });
    await expect(dispatcher.dispatch('x')).rejects.toThrow(/DEEPSEEK/);
  });

  test('cfg.mode 在 dispatcher 构造时捕获，dispatch 只接 symptom', async () => {
    const dispatcher = createSkillDispatcher({ mode: 'mock' });
    const reply = await dispatcher.dispatch('x');
    expect(reply.kind).toBe('mock');
  });
});
