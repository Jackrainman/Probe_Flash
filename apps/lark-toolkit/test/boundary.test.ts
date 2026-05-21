import { describe, test, expect } from 'vitest';
import { route } from '../src/boundary';

describe('route', () => {
  test('im.v1.message.create → sdk (reply 同步 3 秒 ack 路径)', () => {
    expect(route('im.v1.message.create')).toBe('sdk');
  });

  test('bitable.v1.tables.create → cli (非 sdk 白名单走 CLI)', () => {
    expect(route('bitable.v1.tables.create')).toBe('cli');
  });

  test('im.v1.chat.create → cli (建群非 3 秒 ack 路径)', () => {
    expect(route('im.v1.chat.create')).toBe('cli');
  });

  test('未知 method → cli (默认走 CLI 兜底)', () => {
    expect(route('foo.bar.baz')).toBe('cli');
  });
});
