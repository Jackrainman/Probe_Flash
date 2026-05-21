import type { SkillReply } from '../types.js';

export function claudeChecklist(_symptom: string): SkillReply {
  throw new Error(
    'claude mode is not implemented in MVP; configure ANTHROPIC_API_KEY and add a provider call in a follow-up task',
  );
}
