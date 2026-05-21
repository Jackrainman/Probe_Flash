export type SkillMode = 'mock' | 'claude' | 'deepseek';

export interface SkillReply {
  kind: 'mock' | 'claude' | 'deepseek' | 'help' | 'error';
  text: string;
}

export interface SkillDispatcher {
  dispatch(symptom: string): Promise<SkillReply>;
}

export interface SkillDispatcherConfig {
  mode: SkillMode;
}
