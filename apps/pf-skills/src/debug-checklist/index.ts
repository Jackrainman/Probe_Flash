import type { SkillMode, SkillReply } from '../types.js';
import { mockChecklist } from './mock.js';
import { claudeChecklist } from './claude.js';
import { deepseekChecklist } from './deepseek.js';

export function dispatchDebugChecklist(
  symptom: string,
  mode: SkillMode,
): SkillReply {
  switch (mode) {
    case 'mock':
      return mockChecklist(symptom);
    case 'claude':
      return claudeChecklist(symptom);
    case 'deepseek':
      return deepseekChecklist(symptom);
  }
}
