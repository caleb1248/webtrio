import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { MAX_CHAT_LENGTH, type ChatMessage } from "../server/protocol";

/** How close to the bottom, in px, still counts as following the chat. */
const STICK_THRESHOLD = 40;

interface ChatProps {
  messages: ChatMessage[];
  memberId: string | null;
  onSend: (text: string) => void;
}

export function Chat({ messages, memberId, onSend }: ChatProps) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  /** Whether to keep the newest message in view, false once the user scrolls up. */
  const stick = useRef(true);

  useLayoutEffect(() => {
    if (stick.current && list.current) {
      list.current.scrollTop = list.current.scrollHeight;
    }
  }, [messages]);

  function submit(event: Event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    stick.current = true;
  }

  return (
    <div class="flex flex-col h-full">
      <h3 class="px-4 pt-4 pb-2 text-sm font-bold tracking-widest text-zinc-400 uppercase">
        Chat
      </h3>
      <div
        ref={list}
        class="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
        }}
      >
        {messages.length === 0 && (
          <p class="text-sm text-zinc-500">No messages yet.</p>
        )}
        {messages.map((message, i) => (
          <p key={i} class="text-sm break-words">
            <span
              class={`font-bold ${message.from.id === memberId ? "text-zinc-300" : "text-zinc-400"}`}
            >
              {message.from.name}
            </span>
            <span class="text-zinc-500">: </span>
            {message.text}
          </p>
        ))}
      </div>
      <form class="p-4" onSubmit={submit}>
        <input
          class="w-full px-3 py-2 bg-zinc-800 rounded-lg placeholder:text-zinc-500"
          placeholder="Say something…"
          maxLength={MAX_CHAT_LENGTH}
          value={draft}
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
      </form>
    </div>
  );
}
