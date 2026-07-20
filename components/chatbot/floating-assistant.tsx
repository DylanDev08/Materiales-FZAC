"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, X } from "lucide-react";
import { ASSISTANT_OPEN_EVENT, type AssistantOpenDetail } from "@/components/chatbot/assistant-launcher";

type AssistantAction = {
  label: string;
  message?: string;
  href?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  options?: AssistantAction[];
};

type AssistantResponse = {
  message?: string;
  conversationId?: string;
  options?: string[];
  actions?: AssistantAction[];
};

const HISTORY_KEY = "fzac-assistant-history-v1";
const CONVERSATION_KEY = "fzac-assistant-conversation-id";
const VISITOR_KEY = "fzac-visitor-id";
const initialOptions = ["Comprar materiales", "Consultar envio", "Medios de pago", "Estado de pedido"];
const initialActions = initialOptions.map((label) => ({ label, message: label }));

function normalizeActions(data: AssistantResponse) {
  if (Array.isArray(data.actions) && data.actions.length) return data.actions.slice(0, 4);
  return (data.options ?? initialOptions).slice(0, 4).map((label) => ({ label, message: label }));
}

function WhatsappLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width="24" height="24" focusable="false">
      <path
        fill="currentColor"
        d="M16.02 3.2c-7.03 0-12.74 5.7-12.74 12.72 0 2.25.59 4.45 1.72 6.39L3.2 28.8l6.65-1.74a12.72 12.72 0 0 0 6.17 1.57h.01c7.02 0 12.73-5.7 12.73-12.73S23.05 3.2 16.02 3.2Zm0 23.28h-.01c-1.95 0-3.86-.52-5.52-1.5l-.4-.24-3.94 1.03 1.05-3.84-.26-.39a10.52 10.52 0 0 1-1.61-5.62c0-5.84 4.76-10.59 10.61-10.59 2.83 0 5.5 1.1 7.5 3.1s3.1 4.66 3.1 7.49c0 5.84-4.75 10.56-10.52 10.56Zm5.81-7.92c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.68.08-.32-.16-1.34-.49-2.55-1.56-.94-.84-1.58-1.88-1.77-2.2-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54l-.61-.01c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64s1.14 3.07 1.3 3.28c.16.21 2.24 3.41 5.42 4.78.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z"
      />
    </svg>
  );
}

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
  const [quickOptions, setQuickOptions] = useState<AssistantAction[]>(initialActions);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const askRef = useRef<(text: string) => Promise<void>>(async () => undefined);
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
          "Hola, soy AI Chatbot FZAC. Puedo ayudarte con materiales, stock, pagos, retiro y envio paso a paso. Elegi una opcion o escribi tu duda.",
        createdAt: new Date().toISOString(),
        options: initialActions
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    askRef.current = ask;
  });

  useEffect(() => {
    function openFromPage(event: Event) {
      const detail = (event as CustomEvent<AssistantOpenDetail>).detail;
      setOpen(true);
      if (detail?.message?.trim()) {
        window.setTimeout(() => void askRef.current(detail.message!.trim()), 0);
      }
    }

    window.addEventListener(ASSISTANT_OPEN_EVENT, openFromPage);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, openFromPage);
  }, []);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || loading) return;

    const nextUserMessage: Message = { role: "user", content: message, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, nextUserMessage]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          conversationId,
          visitorId: visitorId(),
          history: messages.slice(-8)
        })
      });

      const data = (await response.json()) as AssistantResponse;
      if (!response.ok) throw new Error(data.message || "No pude responder esa consulta.");

      if (data.conversationId) {
        setConversationId(data.conversationId);
        window.localStorage.setItem(CONVERSATION_KEY, data.conversationId);
      }

      const actions = normalizeActions(data);
      setQuickOptions(actions);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.message ||
            "Puedo seguir ayudandote con compra, stock, pagos o envio. Elegi una opcion y avanzamos paso a paso.",
          createdAt: new Date().toISOString(),
          options: actions
        }
      ]);
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: timedOut
            ? "La respuesta tardo mas de lo esperado. Te dejo opciones rapidas para seguir sin perder la conversacion."
            : "No pude conectar con el asistente en este momento. Probá de nuevo o usá WhatsApp si necesitás resolverlo ahora.",
          createdAt: new Date().toISOString(),
          options: ["Reintentar", "Consultar envio", "Medios de pago", "Ver productos"].map((label) => ({ label, message: label }))
        }
      ]);
      setQuickOptions(["Reintentar", "Consultar envio", "Medios de pago", "Ver productos"].map((label) => ({ label, message: label })));
    } finally {
      window.clearTimeout(timeout);
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
              <Bot size={18} /> AI CHATBOT FZAC
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              <X size={18} />
            </button>
          </header>

          <div className="floating-chat__messages">
            {messages.map((message, index) => (
              <div className={`chatbot__turn ${message.role === "user" ? "chatbot__turn--user" : ""}`} key={`${message.createdAt}-${index}`}>
                <div className={`chatbot__message ${message.role === "user" ? "chatbot__message--user" : ""}`}>
                  {message.content}
                </div>
                {message.role === "assistant" && message.options?.length ? (
                  <div className="chatbot__inline-options">
                    {message.options.slice(0, 4).map((option) =>
                      option.href ? (
                        <Link href={option.href} key={`${option.label}-${option.href}`} onClick={() => setOpen(false)}>
                          {option.label}
                        </Link>
                      ) : (
                        <button disabled={loading} key={`${option.label}-${option.message}`} type="button" onClick={() => ask(option.message || option.label)}>
                          {option.label}
                        </button>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {loading ? <div className="chatbot__message">Estoy revisando catálogo, pagos y reglas de entrega...</div> : null}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot__quick">
            {quickOptions.slice(0, 4).map((option) =>
              option.href ? (
                <Link href={option.href} key={`${option.label}-${option.href}`} onClick={() => setOpen(false)}>
                  {option.label}
                </Link>
              ) : (
                <button disabled={loading} key={`${option.label}-${option.message}`} type="button" onClick={() => ask(option.message || option.label)}>
                  {option.label}
                </button>
              )
            )}
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
        <WhatsappLogo />
      </a>
      <button className="floating-chat-button" type="button" onClick={() => setOpen((current) => !current)} aria-label="Abrir asistente FZAC">
        <Bot size={22} />
        <span>AI CHATBOT FZAC</span>
      </button>
    </div>
  );
}
