import type { SkillReply } from '../types.js';

export function deepseekChecklist(_symptom: string): SkillReply {
  throw new Error(
    'deepseek mode is not implemented in MVP; configure DEEPSEEK_API_KEY and add a provider call in a follow-up task',
  );
}
