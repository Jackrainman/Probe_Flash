import * as lark from '@larksuiteoapi/node-sdk';
import type { Client } from '@larksuiteoapi/node-sdk';
import type { ToolkitConfig, SendReplyArgs } from './types.js';

export function createSdkClient(cfg: ToolkitConfig): Client {
  return new lark.Client({
    appId: cfg.larkAppId,
    appSecret: cfg.larkAppSecret,
    domain: cfg.larkDomain === 'lark' ? lark.Domain.Lark : lark.Domain.Feishu,
    appType: lark.AppType.SelfBuild,
  });
}

export async function sdkReply(
  client: Client,
  args: SendReplyArgs,
): Promise<void> {
  void args.replyToMessageId;
  await client.im.v1.message.create({
    params: { receive_id_type: 'chat_id' as const },
    data: {
      receive_id: args.chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: args.text }),
    },
  });
}
