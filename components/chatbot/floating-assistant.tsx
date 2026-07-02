"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const HISTORY_KEY = "fzac-assistant-history-v1";
const CONVERSATION_KEY = "fzac-assistant-conversation-id";
const VISITOR_KEY = "fzac-visitor-id";

const starters = ["Que materiales necesito?", "Como compro?", "Envios a mi zona", "Medios de pago"];

function visitorId() {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_KEY, next);
  return next;
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CONVERSATION_KEY);
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        if (raw) return JSON.parse(raw) as Message[];
      } catch {
        window.localStorage.removeItem(HISTORY_KEY);
      }
    }

    return [
      {
        role: "assistant",
        content:
          "Hola, soy el asistente FZAC. Puedo orientarte con materiales, cantidades aproximadas, stock, pagos, envios, retiro y derivacion a atencion comercial.",
        createdAt: new Date().toISOString()
      }
    ];
  });

  const whatsapp = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_FZAC_WHATSAPP || "";
    return configured.replace(/\D/g, "") || "5493415847000";
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    const nextUserMessage: Message = { role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, nextUserMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId,
          visitorId: visitorId(),
          history: messages.slice(-8)
        })
      });

      const data = (await response.json()) as { message?: string; conversationId?: string };

      if (data.conversationId) {
        setConversationId(data.conversationId);
        window.localStorage.setItem(CONVERSATION_KEY, data.conversationId);
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.message ||
            "No pude resolver esa consulta con seguridad. Te recomiendo escribir por WhatsApp para que un asesor FZAC lo revise.",
          createdAt: new Date().toISOString()
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "No pude conectar con el asistente en este momento. Podés escribir por WhatsApp y continuar la consulta con atención humana.",
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div className="floating-assist" aria-live="polite">
      {open ? (
        <section className="floating-chat" aria-label="Asistente FZAC">
          <header className="floating-chat__head">
            <span>
              <Bot size={18} /> AI BOT FZAC
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </button>
          </header>

          <div className="floating-chat__messages">
            {messages.map((message, index) => (
              <div className={`chatbot__message ${message.role === "user" ? "chatbot__message--user" : ""}`} key={`${message.createdAt}-${index}`}>
                {message.content}
              </div>
            ))}
            {loading ? <div className="chatbot__message">Estoy revisando catálogo, pagos y reglas de entrega...</div> : null}
          </div>

          <div className="chatbot__quick">
            {starters.map((starter) => (
              <button key={starter} type="button" onClick={() => ask(starter)}>
                {starter}
              </button>
            ))}
          </div>

          <form className="chatbot__form" onSubmit={submit}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribi tu duda" maxLength={500} />
            <button className="btn" type="submit" disabled={loading}>
              <Send size={16} />
            </button>
          </form>
        </section>
      ) : null}

      <a className="floating-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp FZAC">
        <MessageCircle size={22} />
      </a>
      <button className="floating-chat-button" type="button" onClick={() => setOpen((current) => !current)} aria-label="Abrir asistente FZAC">
        <Bot size={22} />
      </button>
    </div>
  );
}
