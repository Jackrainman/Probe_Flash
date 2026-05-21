import { describe, test, expect } from 'vitest';
import { claudeChecklist } from '../src/debug-checklist/claude';
import { deepseekChecklist } from '../src/debug-checklist/deepseek';

describe('claudeChecklist stub', () => {
  test('throws not-implemented with ANTHROPIC_API_KEY hint', () => {
    expect(() => claudeChecklist('x')).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('deepseekChecklist stub', () => {
  test('throws not-implemented with DEEPSEEK_API_KEY hint', () => {
    expect(() => deepseekChecklist('x')).toThrow(/DEEPSEEK_API_KEY/);
  });
});
