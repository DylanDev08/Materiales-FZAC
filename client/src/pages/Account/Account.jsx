import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiBox,
  FiCheckCircle,
  FiCreditCard,
  FiDollarSign,
  FiHeart,
  FiLock,
  FiLogOut,
  FiMapPin,
  FiMessageCircle,
  FiMoon,
  FiPackage,
  FiSave,
  FiSettings,
  FiShoppingCart,
  FiSun,
  FiUser
} from 'react-icons/fi';

import { authApi } from '../../api/authApi';
import { assistantApi } from '../../api/assistantApi';
import { useAuth } from '../../context/AuthContext';
import { currency, statusLabel } from '../../utils/formatters';

const tabs = [
  { id: 'overview', label: 'Resumen', icon: FiBox },
  { id: 'orders', label: 'Compras', icon: FiPackage },
  { id: 'cart', label: 'Carrito guardado', icon: FiShoppingCart },
  { id: 'favorites', label: 'Favoritos', icon: FiHeart },
  { id: 'chats', label: 'Asistencia', icon: FiMessageCircle },
  { id: 'settings', label: 'Ajustes', icon: FiSettings },
  { id: 'security', label: 'Seguridad', icon: FiLock }
];

const defaultPreferences = {
  marketingEmails: false,
  orderUpdates: true,
  assistantHistory: true,
  theme: 'system',
  preferredShipping: '',
  preferredPayment: 'MERCADOPAGO',
  avatarUrl: '',
  biometricLogin: false
};

export const Account = () => {
  const { user, logout, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [summary, setSummary] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [settings, setSettings] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    ...defaultPreferences
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', nextPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const data = await authApi.accountSummary();
      setSummary(data);
      setSettings((current) => ({
        ...current,
        name: user?.name || current.name,
        phone: user?.phone || current.phone,
        ...defaultPreferences,
        ...(data.preferences || {})
      }));
    } catch (loadError) {
      setError(loadError.message || 'No pudimos cargar el resumen de la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const rows = await assistantApi.conversations();
      setConversations(Array.isArray(rows) ? rows : []);
    } catch {
      setConversations([]);
    }
  };

  useEffect(() => {
    loadSummary();
    loadConversations();
  }, []);

  useEffect(() => {
    setSettings((current) => ({ ...current, name: user?.name || '', phone: user?.phone || '' }));
  }, [user]);

  const selectTab = (nextTab) => {
    setTab(nextTab);
    setSearchParams(nextTab === 'overview' ? {} : { tab: nextTab });
    setMessage('');
    setError('');
  };

  const paidOrders = summary?.orders?.latest?.filter((order) => !['PENDING', 'PENDING_PAYMENT', 'CANCELLED'].includes(order.status)) || [];
  const pendingOrders = summary?.orders?.latest?.filter((order) => ['PENDING', 'PENDING_PAYMENT'].includes(order.status)) || [];

  const metrics = useMemo(() => [
    { label: 'Compras realizadas', value: summary?.orders?.paid || 0 },
    { label: 'En espera', value: summary?.orders?.pending || 0 },
    { label: 'Productos en carrito', value: summary?.cart?.itemsCount || 0 },
    { label: 'Total comprado', value: currency(summary?.spent || 0) }
  ], [summary]);

  const saveSettings = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      const updatedUser = await authApi.updateSettings(settings);
      await refreshUser?.(updatedUser);
      await loadSummary();
      setMessage('Ajustes guardados correctamente.');
    } catch (saveError) {
      setError(saveError.message || 'No pudimos guardar los ajustes.');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      await authApi.changePassword(passwords);
      setPasswords({ currentPassword: '', nextPassword: '' });
      setMessage('Contraseña actualizada correctamente.');
    } catch (passwordError) {
      setError(passwordError.message || 'No pudimos cambiar la contraseña.');
    }
  };

  const openConversation = async (id) => {
    try {
      const conversation = await assistantApi.conversation(id);
      setSelectedConversation(conversation);
    } catch (conversationError) {
      setError(conversationError.message || 'No pudimos abrir la conversación.');
    }
  };

  const sendConversationMessage = async (event) => {
    event.preventDefault();
    const clean = chatMessage.trim();
    if (!clean || !selectedConversation) return;

    try {
      await assistantApi.userMessage(selectedConversation.id, clean);
      setChatMessage('');
      await openConversation(selectedConversation.id);
      await loadConversations();
    } catch (chatError) {
      setError(chatError.message || 'No pudimos enviar el mensaje.');
    }
  };

  const requestAdmin = async () => {
    if (!selectedConversation) return;
    try {
      await assistantApi.requestAdmin(selectedConversation.id);
      await openConversation(selectedConversation.id);
      await loadConversations();
      setMessage('La conversación fue derivada a atención FZAC.');
    } catch (requestError) {
      setError(requestError.message || 'No pudimos derivar la conversación.');
    }
  };

  const removeFavorite = async (productId) => {
    try {
      await authApi.removeFavorite(productId);
      await loadSummary();
    } catch (favoriteError) {
      setError(favoriteError.message || 'No pudimos quitar el favorito.');
    }
  };

  return (
    <main className="account-shell">
      <div className="container">
        <header className="account-shell__head">
          <div>
            <span className="kicker">Centro de cuenta</span>
            <h1>Hola, {user?.name?.split(' ')[0] || 'cliente'}.</h1>
            <p>Gestioná compras, pedidos pendientes, carrito, favoritos, conversaciones y seguridad.</p>
          </div>
          {user?.avatarUrl ? (
            <img className="account-shell__avatar" src={user.avatarUrl} alt={user.name} />
          ) : (
            <div className="account-shell__avatar account-shell__avatar--fallback"><FiUser /></div>
          )}
        </header>

        <div className="account-shell__layout">
          <aside className="account-nav-v2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => selectTab(id)}>
                <Icon /> {label}
              </button>
            ))}
            <button type="button" onClick={logout}><FiLogOut /> Cerrar sesión</button>
          </aside>

          <section className="account-dashboard-v2">
            {(message || error) && (
              <div className={error ? 'account-alert account-alert--error' : 'account-alert'}>
                {error || message}
              </div>
            )}

            {loading && <div className="account-section-v2"><p>Cargando tu cuenta...</p></div>}

            {!loading && tab === 'overview' && (
              <>
                <div className="account-metrics-v2">
                  {metrics.map((metric) => (
                    <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>
                  ))}
                </div>

                <article className="account-section-v2">
                  <div className="account-section-v2__head">
                    <div><span className="kicker">Actividad</span><h2>Últimos pedidos</h2></div>
                    <button type="button" className="btn secondary" onClick={() => selectTab('orders')}>Ver todos</button>
                  </div>
                  <div className="account-order-list-v2">
                    {(summary?.orders?.latest || []).slice(0, 5).map((order) => (
                      <div className="account-order-v2" key={order.id}>
                        <div><strong>Pedido {order.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleDateString('es-AR')} · {statusLabel(order.status)}</small></div>
                        <b>{currency(order.total)}</b>
                      </div>
                    ))}
                    {!summary?.orders?.latest?.length && <p>Todavía no tenés pedidos.</p>}
                  </div>
                </article>

                <article className="account-section-v2">
                  <div className="account-section-v2__head">
                    <div><span className="kicker">Asistencia</span><h2>Conversaciones recientes</h2></div>
                    <button type="button" className="btn secondary" onClick={() => selectTab('chats')}>Abrir chat</button>
                  </div>
                  <div className="account-chat-list-v2">
                    {(summary?.conversations || []).slice(0, 4).map((conversation) => (
                      <button className="account-chat-v2" type="button" key={conversation.id} onClick={() => { selectTab('chats'); openConversation(conversation.id); }}>
                        <div><strong>{conversation.subject || 'Conversación FZAC'}</strong><small>{conversation.lastMessage?.content || 'Sin mensajes'}</small></div>
                        <span>{conversation.status}</span>
                      </button>
                    ))}
                    {!summary?.conversations?.length && <p>Podés iniciar una consulta desde el asistente flotante.</p>}
                  </div>
                </article>
              </>
            )}

            {!loading && tab === 'orders' && (
              <article className="account-section-v2">
                <div className="account-section-v2__head"><div><span className="kicker">Historial</span><h2>Productos comprados y en espera</h2></div></div>
                <h3 className="account-subtitle-v2">Compras confirmadas</h3>
                <div className="account-order-list-v2">
                  {paidOrders.map((order) => (
                    <div className="account-order-v2" key={order.id}>
                      <div><strong>Pedido {order.id.slice(0, 8).toUpperCase()}</strong><small>{statusLabel(order.status)} · {order.items?.length || 0} productos</small></div>
                      <b>{currency(order.total)}</b>
                    </div>
                  ))}
                  {!paidOrders.length && <p>No hay compras confirmadas todavía.</p>}
                </div>
                <h3 className="account-subtitle-v2">Pedidos en espera</h3>
                <div className="account-order-list-v2">
                  {pendingOrders.map((order) => (
                    <div className="account-order-v2" key={order.id}>
                      <div><strong>Pedido {order.id.slice(0, 8).toUpperCase()}</strong><small>{statusLabel(order.status)}</small></div>
                      <b>{currency(order.total)}</b>
                    </div>
                  ))}
                  {!pendingOrders.length && <p>No hay pedidos esperando pago.</p>}
                </div>
              </article>
            )}

            {!loading && tab === 'cart' && (
              <article className="account-section-v2">
                <div className="account-section-v2__head"><div><span className="kicker">Carrito sincronizado</span><h2>Productos guardados en tu cuenta</h2></div><Link className="btn" to="/carrito">Abrir carrito</Link></div>
                <div className="account-cart-list-v2">
                  {(summary?.cart?.items || []).map((item) => (
                    <div className="account-cart-v2" key={item.id}>
                      <div><strong>{item.product?.name}</strong><small>{item.quantity} × {currency(item.product?.price)}</small></div>
                      <b>{currency(item.total)}</b>
                    </div>
                  ))}
                  {!summary?.cart?.items?.length && <p>No hay productos guardados en el carrito de tu cuenta.</p>}
                </div>
              </article>
            )}

            {!loading && tab === 'favorites' && (
              <article className="account-section-v2">
                <div className="account-section-v2__head"><div><span className="kicker">Favoritos</span><h2>Productos guardados</h2></div></div>
                <div className="account-product-grid-v2">
                  {(summary?.favorites || []).map((favorite) => (
                    <article className="account-product-v2" key={favorite.id}>
                      <Link to={`/producto/${favorite.product?.slug}`}><img src={favorite.product?.image} alt={favorite.product?.name} /></Link>
                      <strong>{favorite.product?.name}</strong>
                      <span>{currency(favorite.product?.price)}</span>
                      <button type="button" onClick={() => removeFavorite(favorite.product?.id)}>Quitar</button>
                    </article>
                  ))}
                  {!summary?.favorites?.length && <p>No guardaste productos todavía.</p>}
                </div>
              </article>
            )}

            {!loading && tab === 'chats' && (
              <article className="account-section-v2 account-chat-center-v2">
                <div className="account-section-v2__head"><div><span className="kicker">FZAC Asistencia</span><h2>Chat con el bot o un administrador</h2></div></div>
                <div className="account-chat-center-v2__layout">
                  <div className="account-chat-center-v2__list">
                    {conversations.map((conversation) => (
                      <button key={conversation.id} type="button" className={selectedConversation?.id === conversation.id ? 'active' : ''} onClick={() => openConversation(conversation.id)}>
                        <strong>{conversation.subject || 'Consulta FZAC'}</strong>
                        <span>{conversation.channel} · {conversation.status}</span>
                      </button>
                    ))}
                    {!conversations.length && <p>Iniciá una conversación con el asistente flotante.</p>}
                  </div>

                  <div className="account-chat-center-v2__conversation">
                    {selectedConversation ? (
                      <>
                        <div className="account-chat-center-v2__messages">
                          {(selectedConversation.messages || []).map((item) => (
                            <article className={item.role === 'USER' ? 'user' : item.role === 'ADMIN' ? 'admin' : 'assistant'} key={item.id}>
                              <small>{item.role === 'ADMIN' ? 'Atención FZAC' : item.role === 'USER' ? 'Vos' : 'FZAC Asistente'}</small>
                              <p>{item.content}</p>
                            </article>
                          ))}
                        </div>
                        <form className="account-chat-center-v2__composer" onSubmit={sendConversationMessage}>
                          <textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Escribí tu consulta..." />
                          <button className="btn" type="submit">Enviar</button>
                        </form>
                        {selectedConversation.channel !== 'SUPPORT' && <button className="btn secondary" type="button" onClick={requestAdmin}>Hablar con un administrador</button>}
                      </>
                    ) : (
                      <div className="account-chat-center-v2__empty"><FiMessageCircle /><p>Seleccioná una conversación.</p></div>
                    )}
                  </div>
                </div>
              </article>
            )}

            {!loading && tab === 'settings' && (
              <article className="account-section-v2">
                <div className="account-section-v2__head"><div><span className="kicker">Ajustes</span><h2>Preferencias de la cuenta</h2></div></div>
                <div className="account-settings-layout-v2">
                  <aside className="account-settings-sidebar-v2">
                    <div className="account-profile-card-v2">
                      {settings.avatarUrl || user?.avatarUrl ? (
                        <img src={settings.avatarUrl || user.avatarUrl} alt={settings.name || user?.name} />
                      ) : (
                        <div><FiUser /></div>
                      )}
                      <strong>{settings.name || user?.name}</strong>
                      <span>{user?.email}</span>
                    </div>
                    <div className="account-preference-stack-v2">
                      <article><FiDollarSign /><span>Saldo disponible</span><strong>{currency(summary?.balance || 0)}</strong></article>
                      <article><FiCreditCard /><span>Tipo de pagos</span><strong>{settings.preferredPayment === 'TRANSFER' ? 'Transferencia' : settings.preferredPayment === 'CASH_ON_PICKUP' ? 'Pago al retirar' : 'Mercado Pago'}</strong></article>
                      <article><FiMapPin /><span>Entrega preferida</span><strong>{settings.preferredShipping === 'DELIVERY' ? 'Envio' : settings.preferredShipping === 'PICKUP' ? 'Retiro en local' : 'Sin preferencia'}</strong></article>
                      <article>{settings.theme === 'light' ? <FiSun /> : <FiMoon />}<span>Color</span><strong>{settings.theme === 'light' ? 'Blanco' : settings.theme === 'dark' ? 'Negro' : 'Sistema'}</strong></article>
                      <article><FiCheckCircle /><span>Huella dactilar</span><strong>{settings.biometricLogin ? 'Solicitada' : 'Inactiva'}</strong></article>
                    </div>
                  </aside>

                <form className="account-form-v2 account-form-v2--settings" onSubmit={saveSettings}>
                  <label>Nombre y apellido<input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} required /></label>
                  <label className="account-form-v2__wide">Foto de perfil<input value={settings.avatarUrl || ''} onChange={(event) => setSettings({ ...settings, avatarUrl: event.target.value })} placeholder="https://..." /></label>
                  <label>Tipo de pagos<select value={settings.preferredPayment || 'MERCADOPAGO'} onChange={(event) => setSettings({ ...settings, preferredPayment: event.target.value })}><option value="MERCADOPAGO">Mercado Pago</option><option value="TRANSFER">Transferencia</option><option value="CASH_ON_PICKUP">Pago al retirar</option></select></label>
                  <label>Teléfono<input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} /></label>
                  <label>Tema<select value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value })}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
                  <label>Modalidad preferida<select value={settings.preferredShipping || ''} onChange={(event) => setSettings({ ...settings, preferredShipping: event.target.value })}><option value="">Sin preferencia</option><option value="PICKUP">Retiro</option><option value="DELIVERY">Envío</option></select></label>
                  <label className="check-row"><input type="checkbox" checked={Boolean(settings.orderUpdates)} onChange={(event) => setSettings({ ...settings, orderUpdates: event.target.checked })} /> Recibir novedades de pedidos</label>
                  <label className="check-row"><input type="checkbox" checked={Boolean(settings.assistantHistory)} onChange={(event) => setSettings({ ...settings, assistantHistory: event.target.checked })} /> Guardar historial del asistente</label>
                  <label className="check-row"><input type="checkbox" checked={Boolean(settings.marketingEmails)} onChange={(event) => setSettings({ ...settings, marketingEmails: event.target.checked })} /> Recibir promociones</label>
                  <button className={`account-biometric-v2 ${settings.biometricLogin ? 'active' : ''}`} type="button" onClick={() => {
                    const supported = Boolean(window.PublicKeyCredential);
                    setSettings({ ...settings, biometricLogin: supported });
                    setMessage(supported ? 'La verificacion por huella quedo preparada para este navegador.' : 'Este navegador no informa soporte de biometria.');
                  }}><FiLock /><span><strong>Ingreso con huella dactilar</strong><small>Preparado con WebAuthn para una futura validacion segura.</small></span></button>
                  <button className="btn" type="submit"><FiSave /> Guardar ajustes</button>
                </form>
                </div>
              </article>
            )}

            {!loading && tab === 'security' && (
              <article className="account-section-v2">
                <div className="account-section-v2__head"><div><span className="kicker">Seguridad</span><h2>Contraseña y acceso</h2></div></div>
                <form className="account-form-v2" onSubmit={changePassword}>
                  <label>Contraseña actual<input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} autoComplete="current-password" /></label>
                  <label>Nueva contraseña<input type="password" minLength="8" value={passwords.nextPassword} onChange={(event) => setPasswords({ ...passwords, nextPassword: event.target.value })} autoComplete="new-password" required /></label>
                  <button className="btn" type="submit"><FiLock /> Cambiar contraseña</button>
                </form>
              </article>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};
