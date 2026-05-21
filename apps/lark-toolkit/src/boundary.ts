export type Channel = 'sdk' | 'cli';

const SDK_METHODS = new Set<string>([
  'im.v1.message.create',
]);

export function route(method: string): Channel {
  return SDK_METHODS.has(method) ? 'sdk' : 'cli';
}
