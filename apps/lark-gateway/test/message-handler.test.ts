import { describe, test, expect, vi } from 'vitest';
import { handleMessage, stripMention } from '../src/message-handler';
import type { Config } from '../src/config';
import type { LarkMessageEvent } from '../src/types';

const cfg: Config = {
  LARK_APP_ID: 'app',
  LARK_APP_SECRET: 'secret',
  LARK_BOT_OPEN_ID: 'ou_bot',
  LARK_DOMAIN: 'feishu',
  PROBEFLASH_SKILL_MODE: 'mock',
};

// Client is opaque to handleMessage; it just passes through to sendReply
const fakeClient = {} as never;

interface MakeEventOpts {
  text?: string;
  type?: string;
  mentions?: Array<{ key: string; id: { open_id: string } }>;
}

function makeEvent(opts: MakeEventOpts): LarkMessageEvent {
  const type = opts.type ?? 'text';
  return {
    message: {
      chat_id: 'oc_chat',
      message_id: 'om_msg',
      message_type: type,
      content: type === 'text' ? JSON.stringify({ text: opts.text ?? '' }) : '{}',
      mentions: opts.mentions,
    },
    sender: { sender_id: { open_id: 'ou_user' } },
  };
}

describe('handleMessage', () => {
  test('non-text message type → no skill dispatch and no reply', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi.fn();
    await handleMessage(makeEvent({ type: 'post' }), cfg, fakeClient, {
      sendReply,
      dispatchSkill,
    });
    expect(sendReply).not.toHaveBeenCalled();
    expect(dispatchSkill).not.toHaveBeenCalled();
  });

  test('text without @bot mention → no skill dispatch and no reply', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi.fn();
    await handleMessage(
      makeEvent({ text: '大家好', mentions: [] }),
      cfg,
      fakeClient,
      { sendReply, dispatchSkill },
    );
    expect(sendReply).not.toHaveBeenCalled();
    expect(dispatchSkill).not.toHaveBeenCalled();
  });

  test('text @ another user but not @bot → no skill dispatch and no reply', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi.fn();
    await handleMessage(
      makeEvent({
        text: '@_user_2 你看下',
        mentions: [{ key: '@_user_2', id: { open_id: 'ou_other' } }],
      }),
      cfg,
      fakeClient,
      { sendReply, dispatchSkill },
    );
    expect(sendReply).not.toHaveBeenCalled();
    expect(dispatchSkill).not.toHaveBeenCalled();
  });

  test('@bot with empty content after strip → sends help reply, no skill dispatch', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi.fn();
    await handleMessage(
      makeEvent({
        text: '@_user_1 ',
        mentions: [{ key: '@_user_1', id: { open_id: 'ou_bot' } }],
      }),
      cfg,
      fakeClient,
      { sendReply, dispatchSkill },
    );
    expect(dispatchSkill).not.toHaveBeenCalled();
    expect(sendReply).toHaveBeenCalledOnce();
    const replyArg = sendReply.mock.calls[0][3];
    expect(replyArg).toMatchObject({ kind: 'help' });
    expect(replyArg.text).toContain('@我');
  });

  test('@bot with symptom → dispatches skill with symptom, sends reply', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi.fn().mockResolvedValue({
      kind: 'mock' as const,
      text: '[mock] stub reply',
    });
    await handleMessage(
      makeEvent({
        text: '@_user_1 自动跑点又歪了',
        mentions: [{ key: '@_user_1', id: { open_id: 'ou_bot' } }],
      }),
      cfg,
      fakeClient,
      { sendReply, dispatchSkill },
    );
    expect(dispatchSkill).toHaveBeenCalledOnce();
    expect(dispatchSkill).toHaveBeenCalledWith('自动跑点又歪了', cfg);
    expect(sendReply).toHaveBeenCalledOnce();
    expect(sendReply.mock.calls[0][3]).toMatchObject({
      kind: 'mock',
      text: '[mock] stub reply',
    });
  });

  test('@bot passes chat_id and message_id to sendReply', async () => {
    const sendReply = vi.fn();
    const dispatchSkill = vi
      .fn()
      .mockResolvedValue({ kind: 'mock' as const, text: 'x' });
    await handleMessage(
      makeEvent({
        text: '@_user_1 串口又乱码',
        mentions: [{ key: '@_user_1', id: { open_id: 'ou_bot' } }],
      }),
      cfg,
      fakeClient,
      { sendReply, dispatchSkill },
    );
    const [, chatId, messageId] = sendReply.mock.calls[0];
    expect(chatId).toBe('oc_chat');
    expect(messageId).toBe('om_msg');
  });
});

describe('stripMention', () => {
  test('removes single @ token', () => {
    expect(stripMention('@_user_1 hello')).toBe('hello');
  });

  test('removes multiple @ tokens', () => {
    expect(stripMention('@_user_1 fix this @_user_2 thanks')).toBe(
      'fix this thanks',
    );
  });

  test('collapses extra whitespace after removal', () => {
    expect(stripMention('@_user_1   spaced @_user_2   text')).toBe(
      'spaced text',
    );
  });

  test('returns empty string when only @ tokens', () => {
    expect(stripMention('@_user_1 @_user_2')).toBe('');
  });

  test('preserves text without @ tokens', () => {
    expect(stripMention('自动跑点又歪了')).toBe('自动跑点又歪了');
  });
});
