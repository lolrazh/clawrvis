import { BrowserWindow, BrowserView, Utils } from "electrobun/bun";
import type { ClawrvisRPC } from "../rpc";

const OPENCLAW_URL = Bun.env.OPENCLAW_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = Bun.env.OPENCLAW_TOKEN || "";

async function sendToOpenClaw(message: string): Promise<string> {
  const res = await fetch(`${OPENCLAW_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    throw new Error(
      `OpenClaw responded with ${res.status}: ${await res.text()}`,
    );
  }

  const data = await res.json();
  return data.reply ?? data.response ?? data.message ?? JSON.stringify(data);
}

const rpc = BrowserView.defineRPC<ClawrvisRPC>({
  maxRequestTime: 60000,
  handlers: {
    requests: {
      sendMessage: async ({ message }) => {
        try {
          const reply = await sendToOpenClaw(message);
          return { reply };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error("[openclaw]", errorMsg);
          return { reply: "", error: errorMsg };
        }
      },
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: "Clawrvis",
  url: "views://mainview/index.html",
  rpc,
  frame: {
    width: 520,
    height: 700,
    x: 200,
    y: 100,
  },
});

mainWindow.on("close", () => {
  Utils.quit();
});

console.log(`[clawrvis] started — targeting ${OPENCLAW_URL}`);
