import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { askAssistant } from "../lib/api";

const sessionId = "web-" + Math.random().toString(36).slice(2, 10);

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! Thanks for calling Brew Cup Cafe. How can I help? Ask about our menu, prices or recommendations." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { from: "me", text }]);
    setInput(""); setBusy(true);
    try {
      const data = await askAssistant(text, sessionId);
      setMessages((m) => [...m, { from: "bot", text: data.reply || "Sorry, I didn't catch that." }]);
    } catch {
      setMessages((m) => [...m, { from: "bot", text: "Sorry, I can't connect right now. Please try again shortly." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="☎ CALL THE CAFE" onClose={onClose}>
      <div className="h-72 space-y-2 overflow-y-auto rounded-lg bg-black/30 p-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "bg-[#d9a441] text-[#03170e]" : "bg-[#0b2a1b]"}`}>{m.text}</p>
          </div>
        ))}
        {busy && <p className="text-sm opacity-60">Typing…</p>}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-full border border-[#d9a441]/50 bg-black/30 px-4 py-2 outline-none focus:border-[#d9a441]"
          placeholder="Ask about the menu…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={busy} className="rounded-full bg-[#d9a441] px-5 py-2 text-[#03170e] disabled:opacity-50">Send</button>
      </div>
    </Modal>
  );
}
