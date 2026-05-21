export interface ToolkitConfig {
  larkAppId: string;
  larkAppSecret: string;
  larkDomain: 'feishu' | 'lark';
}

export interface SendReplyArgs {
  chatId: string;
  replyToMessageId: string;
  text: string;
}

export interface Toolkit {
  reply(args: SendReplyArgs): Promise<void>;
}

export class CliBridgeError extends Error {
  constructor(
    message: string,
    public exitCode: number | undefined,
    public stderr: string,
  ) {
    super(message);
    this.name = 'CliBridgeError';
  }
}
