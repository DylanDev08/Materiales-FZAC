import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiMessageCircle,
  FiMinimize2,
  FiSend,
  FiUserCheck,
  FiX
} from 'react-icons/fi';

import { assistantApi } from '../../api/assistantApi';
import { useAuth } from '../../context/AuthContext';
import { currency } from '../../utils/formatters';

const VISITOR_KEY = 'fzac_assistant_visitor';
const CONVERSATION_KEY = 'fzac_assistant_conversation';

const createVisitorId = () => {
  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;

  const value = globalThis.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(VISITOR_KEY, value);
  return value;
};

const publicAssistantError =
  'No pude conectar con el asistente en este momento. Proba nuevamente en unos segundos. Si continua, podes pedir atencion FZAC.';

const starterMessage = {
  id: 'welcome',
  role: 'ASSISTANT',
  content:
    'Hola, soy el asistente de Materiales FZAC. Puedo ayudarte con productos, compras, pagos, envios, retiros, pedidos, cuenta y atencion.'
};

export const FzacAssistant = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([starterMessage]);
  const [products, setProducts] = useState([]);
  const [conversationId, setConversationId] = useState(() => localStorage.getItem(CONVERSATION_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  const quickPrompts = useMemo(
    () => [
      'Como compro en Materiales FZAC?',
      'Necesito materiales para una pared de drywall',
      'Puedo retirar o pedir envio?',
      'Quiero hablar con atencion FZAC'
    ],
    []
  );

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, products, open]);

  const send = async (value) => {
    const clean = String(value || '').trim();
    if (!clean || loading) return;

    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, role: 'USER', content: clean }
    ]);
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const response = await assistantApi.chat({
        message: clean,
        conversationId: conversationId || undefined,
        visitorId: user ? undefined : createVisitorId()
      });

      if (response.conversationId) {
        setConversationId(response.conversationId);
        localStorage.setItem(CONVERSATION_KEY, response.conversationId);
      }

      setMessages((current) => [
        ...current,
        {
          id: response.message?.id || `assistant-${Date.now()}`,
          role: 'ASSISTANT',
          content: response.answer
        }
      ]);
      setProducts(response.products || []);
    } catch (requestError) {
      setError(requestError?.message || publicAssistantError);
    } finally {
      setLoading(false);
    }
  };

  const requestHuman = async () => {
    if (!user) {
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'SYSTEM',
          content: 'Ingresa a tu cuenta para guardar la conversacion y derivarla a atencion FZAC.'
        }
      ]);
      return;
    }

    if (!conversationId) {
      await send('Quiero hablar con atencion FZAC');
      return;
    }

    try {
      await assistantApi.requestAdmin(conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'SYSTEM',
          content: 'Listo. La conversacion quedo derivada a atencion FZAC y podes verla desde Mi cuenta.'
        }
      ]);
    } catch (requestError) {
      setError(requestError?.message || 'No pude derivar la conversacion. Proba nuevamente en unos segundos.');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="fzac-assistant-launcher"
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente FZAC"
      >
        <FiMessageCircle />
        <span>Asistente FZAC</span>
      </button>
    );
  }

  return (
    <aside className={`fzac-assistant ${minimized ? 'fzac-assistant--minimized' : ''}`}>
      <header className="fzac-assistant__header">
        <div>
          <span>IA + catalogo</span>
          <strong>Asistente FZAC</strong>
        </div>

        <nav>
          <button type="button" onClick={() => setMinimized((current) => !current)} aria-label="Minimizar">
            <FiMinimize2 />
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
            <FiX />
          </button>
        </nav>
      </header>

      {!minimized && (
        <>
          <div className="fzac-assistant__body" ref={bodyRef}>
            {messages.map((item) => (
              <article
                key={item.id}
                className={`fzac-assistant__message fzac-assistant__message--${String(item.role).toLowerCase()}`}
              >
                {item.content}
              </article>
            ))}

            {loading && <div className="fzac-assistant__typing">...</div>}

            {products.length > 0 && (
              <div className="fzac-assistant__products">
                {products.slice(0, 3).map((product) => (
                  <Link key={product.id} to={`/producto/${product.slug}`} onClick={() => setOpen(false)}>
                    <img src={product.image} alt={product.name} />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{currency(product.price)} - Stock {product.stock}</small>
                    </span>
                    <FiArrowRight />
                  </Link>
                ))}
              </div>
            )}

            {error && <p className="fzac-assistant__error">{error}</p>}
          </div>

          <div className="fzac-assistant__quick">
            {quickPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="fzac-assistant__form"
            onSubmit={(event) => {
              event.preventDefault();
              send(message);
            }}
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribi tu consulta..."
              maxLength={1200}
            />
            <button type="submit" disabled={loading || !message.trim()} aria-label="Enviar">
              <FiSend />
            </button>
          </form>

          <button type="button" className="fzac-assistant__human" onClick={requestHuman}>
            <FiUserCheck /> Hablar con una persona
          </button>
        </>
      )}
    </aside>
  );
};

export default FzacAssistant;
