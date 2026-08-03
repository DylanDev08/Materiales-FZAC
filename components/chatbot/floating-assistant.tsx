"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Bot, RotateCcw, Send, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { ASSISTANT_OPEN_EVENT, type AssistantOpenDetail } from "@/components/chatbot/assistant-launcher";
import type { AssistantAction, AssistantResponse, AssistantSource } from "@/lib/assistant/contracts";

type Message = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  options?: AssistantAction[];
  sources?: AssistantSource[];
  traceId?: string;
  knowledgeId?: string;
  conversationId?: string;
  feedback?: "UP" | "DOWN";
};

const HISTORY_KEY = "fzac-assistant-history-v1";
const CONVERSATION_KEY = "fzac-assistant-conversation-id";
const VISITOR_KEY = "fzac-visitor-id";
const initialOptions = ["Comprar materiales", "Consultar envio", "Medios de pago", "Estado de pedido"];
const initialActions = initialOptions.map((label) => ({ label, message: label }));
const welcomeMessage: Message = {
  role: "assistant",
  content:
    "Hola, soy el asistente de compras FZAC. Puedo ayudarte a encontrar materiales, revisar stock, calcular cantidades y entender pagos o entregas.",
  createdAt: "welcome",
  options: initialActions
};

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

function safeInternalHref(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function normalizeSources(data: AssistantResponse) {
  if (!Array.isArray(data.sources)) return [];
  return data.sources
    .filter((source) => source && typeof source.id === "string" && typeof source.label === "string" && safeInternalHref(source.href))
    .slice(0, 3);
}

function loadStoredMessages() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [welcomeMessage];
    const stored = JSON.parse(raw) as unknown;
    if (!Array.isArray(stored)) return [welcomeMessage];

    const safeMessages = stored.flatMap((item): Message[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<Message>;
      if (
        (candidate.role !== "user" && candidate.role !== "assistant") ||
        typeof candidate.content !== "string" ||
        candidate.content.length === 0 ||
        candidate.content.length > 1200 ||
        typeof candidate.createdAt !== "string"
      ) return [];

      const options = Array.isArray(candidate.options)
        ? candidate.options.filter((option) => {
            if (!option || typeof option.label !== "string" || option.label.length > 80) return false;
            return typeof option.message === "string" || safeInternalHref(option.href);
          }).slice(0, 4)
        : undefined;
      const sources = Array.isArray(candidate.sources)
        ? candidate.sources.filter((source) => {
            return Boolean(
              source &&
              typeof source.id === "string" &&
              typeof source.label === "string" &&
              source.label.length <= 80 &&
              safeInternalHref(source.href)
            );
          }).slice(0, 3)
        : undefined;
      const traceId = typeof candidate.traceId === "string" && /^[0-9a-f-]{36}$/i.test(candidate.traceId)
        ? candidate.traceId
        : undefined;
      const knowledgeId = typeof candidate.knowledgeId === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.knowledgeId)
        ? candidate.knowledgeId
        : undefined;
      const storedConversationId = typeof candidate.conversationId === "string" && /^[0-9a-f-]{36}$/i.test(candidate.conversationId)
        ? candidate.conversationId
        : undefined;
      return [{
        role: candidate.role,
        content: candidate.content,
        createdAt: candidate.createdAt,
        options,
        sources,
        traceId,
        knowledgeId,
        conversationId: storedConversationId,
        feedback: candidate.feedback === "UP" || candidate.feedback === "DOWN" ? candidate.feedback : undefined
      }];
    });
    return safeMessages.length ? safeMessages.slice(-30) : [welcomeMessage];
  } catch {
    window.localStorage.removeItem(HISTORY_KEY);
    return [welcomeMessage];
  }
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const askRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const requestInFlightRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [feedbackNotice, setFeedbackNotice] = useState("");

  const whatsapp = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_FZAC_WHATSAPP || "";
    return configured.replace(/\D/g, "") || "5493415847000";
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      setMessages(loadStoredMessages());
      setConversationId(window.localStorage.getItem(CONVERSATION_KEY));
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages, storageReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const compact = window.matchMedia("(max-width: 620px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (compact) document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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
    if (!message || loading || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
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
      const sources = normalizeSources(data);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.message ||
            "Puedo seguir ayudandote con compra, stock, pagos o envio. Elegi una opcion y avanzamos paso a paso.",
          createdAt: new Date().toISOString(),
          options: actions,
          sources,
          traceId: data.trace_id,
          knowledgeId: data.knowledge_id,
          conversationId: data.conversationId
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
    } finally {
      window.clearTimeout(timeout);
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }

  function resetConversation() {
    if (requestInFlightRef.current) return;
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(CONVERSATION_KEY);
    setConversationId(null);
    setMessages([welcomeMessage]);
    setInput("");
    setFeedbackNotice("Conversacion reiniciada.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  async function submitFeedback(message: Message, rating: "UP" | "DOWN") {
    if (!message.traceId || !message.knowledgeId || !message.conversationId || message.feedback) return;
    setMessages((current) => current.map((item) => item.traceId === message.traceId ? { ...item, feedback: rating } : item));
    setFeedbackNotice("");
    try {
      const response = await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId: message.traceId,
          conversationId: message.conversationId,
          visitorId: visitorId(),
          knowledgeId: message.knowledgeId,
          rating
        })
      });
      if (!response.ok) throw new Error("feedback_failed");
      setFeedbackNotice(rating === "UP" ? "Gracias. Registramos que la respuesta fue util." : "Gracias. La respuesta quedo pendiente de revision humana.");
    } catch {
      setMessages((current) => current.map((item) => item.traceId === message.traceId ? { ...item, feedback: undefined } : item));
      setFeedbackNotice("No pudimos guardar la valoracion. Podes intentarlo nuevamente.");
    }
  }

  return (
    <div className="floating-assist" aria-live="polite">
      {open ? (
        <>
        <button className="floating-chat__backdrop" type="button" aria-label="Cerrar asistente FZAC" onClick={() => setOpen(false)} />
        <section className="floating-chat" role="dialog" aria-labelledby="floating-chat-title">
          <header className="floating-chat__head">
            <div className="floating-chat__identity">
              <span className="floating-chat__avatar"><Bot size={18} /></span>
              <span>
                <strong id="floating-chat-title">Asistente FZAC</strong>
                <small><i aria-hidden="true" /> Disponible para ayudarte</small>
              </span>
            </div>
            <div className="floating-chat__controls">
              <button type="button" onClick={resetConversation} aria-label="Iniciar nueva conversación" title="Nueva conversación">
                <RotateCcw size={17} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat" title="Cerrar">
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="floating-chat__messages" aria-live="polite" aria-busy={loading}>
            {messages.map((message, index) => (
              <div className={`chatbot__turn ${message.role === "user" ? "chatbot__turn--user" : ""}`} key={`${message.createdAt}-${index}`}>
                <div className={`chatbot__message ${message.role === "user" ? "chatbot__message--user" : ""}`}>
                  {message.content}
                </div>
                {message.role === "assistant" && message.sources?.length ? (
                  <div className="chatbot__sources" aria-label="Fuentes de la respuesta">
                    <BookOpen size={13} aria-hidden="true" />
                    <span>Fuente FZAC:</span>
                    {message.sources.map((source) => (
                      <Link href={source.href} key={source.id} onClick={() => setOpen(false)}>{source.label}</Link>
                    ))}
                  </div>
                ) : null}
                {message.role === "assistant" && message.traceId && message.knowledgeId ? (
                  <div className="chatbot__feedback" aria-label="Valorar respuesta">
                    <span>{message.feedback ? "Gracias por ayudarnos a mejorar." : "¿Te sirvió?"}</span>
                    <button
                      aria-label="La respuesta fue útil"
                      aria-pressed={message.feedback === "UP"}
                      disabled={Boolean(message.feedback)}
                      onClick={() => void submitFeedback(message, "UP")}
                      type="button"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      aria-label="La respuesta no fue útil"
                      aria-pressed={message.feedback === "DOWN"}
                      disabled={Boolean(message.feedback)}
                      onClick={() => void submitFeedback(message, "DOWN")}
                      type="button"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                ) : null}
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
            {loading ? (
              <div className="chatbot__message chatbot__message--loading">
                <span aria-hidden="true"><i /><i /><i /></span>
                Revisando información FZAC
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <footer className="floating-chat__composer">
            {feedbackNotice ? <span className="floating-chat__notice" role="status">{feedbackNotice}</span> : null}
            <span className="floating-chat__privacy"><ShieldCheck size={13} /> No compartas datos de tarjeta ni contraseñas.</span>
            <form className="chatbot__form" onSubmit={submit}>
              <input
                aria-label="Consulta para el asistente FZAC"
                autoComplete="off"
                enterKeyHint="send"
                inputMode="text"
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribí tu consulta"
                maxLength={500}
              />
              <button className="btn" type="submit" disabled={loading || !input.trim()} aria-label="Enviar consulta">
                <Send size={16} />
              </button>
            </form>
          </footer>
        </section>
        </>
      ) : null}

      <a className="floating-whatsapp" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" aria-label="WhatsApp FZAC">
        <WhatsappLogo />
      </a>
      <button
        className="floating-chat-button"
        type="button"
        disabled={!storageReady}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Cerrar asistente FZAC" : "Abrir asistente FZAC"}
        aria-expanded={open}
      >
        <Bot size={22} />
        <span>AI CHATBOT FZAC</span>
      </button>
    </div>
  );
}
