import type { RPCSchema } from "electrobun";

export type ClawrvisRPC = {
  bun: RPCSchema<{
    requests: {
      sendMessage: {
        params: { message: string };
        response: { reply: string; error?: string };
      };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {
      appendReply: { text: string };
    };
  }>;
};
