"use client";

import { FormEvent, useState } from "react";
import { Bot, Send } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const quickPrompts = ["Como comprar", "Envios", "Pagos", "Necesito ayuda con materiales"];

export function ChatbotWidget() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hola, soy el asistente FZAC. Puedo ayudarte con compras, envios, pagos, stock y derivacion a atencion humana."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(content: string) {
    const text = content.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = (await response.json()) as { message?: string };
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message || "No pude responder esa consulta. Te derivamos a atencion FZAC." }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "No pude conectar el asistente. Podes escribir por WhatsApp para atencion humana." }
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
    <section className="chatbot" aria-label="Asistente FZAC">
      <div className="section-head">
        <div>
          <span className="kicker">
            <Bot size={16} /> Chatbot FZAC
          </span>
          <h2>Asistencia comercial</h2>
          <p>Consultas rapidas sobre productos, pagos, envios y retiro.</p>
        </div>
      </div>

      <div className="chatbot__messages">
        {messages.map((message, index) => (
          <div
            className={`chatbot__message ${message.role === "user" ? "chatbot__message--user" : ""}`}
            key={`${message.role}-${index}`}
          >
            {message.content}
          </div>
        ))}
      </div>

      <div className="chatbot__quick">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => ask(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <form className="chatbot__form" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Escribi tu consulta" />
        <button className="btn" type="submit" disabled={loading}>
          <Send size={17} />
          Enviar
        </button>
      </form>
    </section>
  );
}
