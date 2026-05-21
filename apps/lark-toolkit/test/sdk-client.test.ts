import { describe, test, expect, vi } from 'vitest';
import { sdkReply } from '../src/sdk-client';
import type { Client } from '@larksuiteoapi/node-sdk';

describe('sdkReply', () => {
  test('calls client.im.v1.message.create with text payload', async () => {
    const create = vi.fn().mockResolvedValue({ data: {} });
    const client = {
      im: { v1: { message: { create } } },
    } as unknown as Client;

    await sdkReply(client, {
      chatId: 'oc_chat',
      replyToMessageId: 'om_msg',
      text: '收到',
    });

    expect(create).toHaveBeenCalledOnce();
    const arg = create.mock.calls[0][0];
    expect(arg.params).toEqual({ receive_id_type: 'chat_id' });
    expect(arg.data.receive_id).toBe('oc_chat');
    expect(arg.data.msg_type).toBe('text');
    expect(JSON.parse(arg.data.content)).toEqual({ text: '收到' });
  });

  test('propagates errors (caller handles retry)', async () => {
    const create = vi.fn().mockRejectedValue(new Error('boom'));
    const client = { im: { v1: { message: { create } } } } as unknown as Client;
    await expect(
      sdkReply(client, { chatId: 'a', replyToMessageId: 'b', text: 'c' }),
    ).rejects.toThrow('boom');
  });
});
