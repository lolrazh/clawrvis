import Electrobun, { Electroview } from "electrobun/view";
import type { ClawrvisRPC } from "../rpc";

const rpc = Electroview.defineRPC<ClawrvisRPC>({
  maxRequestTime: 60000,
  handlers: {
    requests: {},
    messages: {
      appendReply: ({ text }) => {
        addMessage("assistant", text);
      },
    },
  },
});

const electrobun = new Electrobun.Electroview({ rpc });

// --- DOM helpers ---

const messagesEl = document.getElementById("messages")!;
const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send") as HTMLButtonElement;

function addMessage(role: "user" | "assistant" | "error", text: string) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setLoading(on: boolean) {
  sendBtn.disabled = on;
  sendBtn.textContent = on ? "..." : "Send";
}

// --- Send ---

async function send() {
  const message = inputEl.value.trim();
  if (!message) return;

  addMessage("user", message);
  inputEl.value = "";
  setLoading(true);

  try {
    const { reply, error } = await electrobun.rpc.request.sendMessage({
      message,
    });
    if (error) {
      addMessage("error", error);
    } else {
      addMessage("assistant", reply);
    }
  } catch (err) {
    addMessage("error", "Failed to reach main process");
  } finally {
    setLoading(false);
  }
}

sendBtn.addEventListener("click", send);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.focus();
