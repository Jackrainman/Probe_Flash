import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/sdk-client', () => ({
  createSdkClient: vi.fn(() => ({ tag: 'fake-client' })),
  sdkReply: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cli-bridge', () => ({
  cliApi: vi.fn().mockResolvedValue({}),
  ensureLarkCli: vi.fn().mockResolvedValue(undefined),
  resetCliVersionCheck: vi.fn(),
}));

import { createToolkit } from '../src/index';
import { sdkReply } from '../src/sdk-client';
import { cliApi } from '../src/cli-bridge';

const cfg = {
  larkAppId: 'app',
  larkAppSecret: 'secret',
  larkDomain: 'feishu' as const,
};

beforeEach(() => {
  (sdkReply as ReturnType<typeof vi.fn>).mockClear();
  (cliApi as ReturnType<typeof vi.fn>).mockClear();
});

describe('createToolkit().reply', () => {
  test('routes reply (im.v1.message.create) to sdkReply', async () => {
    const toolkit = createToolkit(cfg);
    await toolkit.reply({
      chatId: 'oc_a',
      replyToMessageId: 'om_b',
      text: 'hi',
    });
    expect(sdkReply).toHaveBeenCalledOnce();
    expect(cliApi).not.toHaveBeenCalled();
  });
});
