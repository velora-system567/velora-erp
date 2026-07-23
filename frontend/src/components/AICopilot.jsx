import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, X, Send, Loader2, Sparkles } from "lucide-react";
import { aiApi } from "../services/api";

const SUGGESTIONS = [
  "How is my company doing?",
  "What should I focus on today?",
  "Which invoices are overdue?",
  "What products should I reorder?",
  "Show me top customers",
  "How much revenue this month?",
];

export default function AICopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm Velora AI. Ask me anything about your business. I can check revenue, overdue invoices, inventory, and more." },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: ({ message, history }) => aiApi.chat(message, window.location.pathname, history),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.data?.reply || "I couldn't process that. Please try again." }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    },
  });

  const sendMessage = (text) => {
    const msg = text || input;
    if (!msg.trim() || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ message: msg, history });
  };

  return (
    <>
      {/* Chat bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 hover:scale-105 active:scale-95"
        >
          <Bot size={24} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Velora AI Copilot</p>
                <p className="text-[10px] text-blue-100">Ask anything about your business</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/20">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex h-[400px] flex-col overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500">
                  <Loader2 size={14} className="inline animate-spin mr-1.5" />
                  Thinking...
                </div>
              </div>
            )}

            {messages.length === 1 && (
              <div className="mt-2">
                <p className="mb-2 text-xs font-semibold text-slate-500">Suggestions</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700 transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything..."
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || chatMutation.isPending}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {chatMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
