import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiBarChart2,
  FiBox,
  FiCreditCard,
  FiEdit2,
  FiFileText,
  FiGrid,
  FiMessageCircle,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShoppingBag,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX
} from 'react-icons/fi';

import { adminApi } from '../../api/adminApi';
import { assistantApi } from '../../api/assistantApi';
import { currency, statusLabel } from '../../utils/formatters';

const orderStatuses = [
  'PENDING_PAYMENT',
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
];

const emptyProduct = {
  id: '',
  name: '',
  sku: '',
  categoryId: '',
  categorySlug: '',
  subcategory: 'General',
  brand: 'FZAC',
  stock: 0,
  stockMinimum: 5,
  unit: 'unidad',
  price: '',
  comparePrice: '',
  image: '',
  gallery: [],
  description: '',
  specifications: {},
  active: true,
  featured: false,
  onSale: false
};

const emptyCategory = {
  name: '',
  slug: '',
  description: '',
  image: '',
  active: true,
  sortOrder: 0
};

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
  { id: 'orders', label: 'Pedidos', icon: FiPackage },
  { id: 'tickets', label: 'Tickets', icon: FiFileText },
  { id: 'payments', label: 'Pagos', icon: FiCreditCard },
  { id: 'products', label: 'Productos', icon: FiBox },
  { id: 'categories', label: 'Categorías', icon: FiShoppingBag },
  { id: 'customers', label: 'Clientes', icon: FiUsers },
  { id: 'analytics', label: 'Estadísticas', icon: FiBarChart2 },
  { id: 'chats', label: 'Chats', icon: FiMessageCircle }
];

const list = (value, key) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
};

export const Admin = () => {
  const [tab, setTab] = useState('dashboard');
  const [metrics, setMetrics] = useState(null);
  const [orders, setOrders] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [reply, setReply] = useState('');
  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setError('');
    try {
      const [metricsData, ordersData, ticketsData, paymentsData, productsData, categoriesData, customersData, analyticsData, conversationsData] = await Promise.all([
        adminApi.metrics(),
        adminApi.orders({ limit: 300 }),
        adminApi.tickets({ limit: 300 }),
        adminApi.payments({ limit: 300 }),
        adminApi.products({ limit: 300 }),
        adminApi.categories(),
        adminApi.customers(),
        adminApi.analytics({ days: 30 }),
        assistantApi.adminConversations()
      ]);

      setMetrics(metricsData);
      setOrders(list(ordersData, 'orders'));
      setTickets(list(ticketsData, 'tickets'));
      setPayments(list(paymentsData, 'payments'));
      setProducts(list(productsData, 'products'));
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setCustomers(list(customersData, 'customers'));
      setAnalytics(analyticsData);
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);

      if (!productForm.categoryId && Array.isArray(categoriesData) && categoriesData[0]) {
        setProductForm((current) => ({ ...current, categoryId: categoriesData[0].id, categorySlug: categoriesData[0].slug }));
      }
    } catch (loadError) {
      setError(loadError.message || 'No pudimos cargar el panel administrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const search = productSearch.toLowerCase().trim();
    if (!search) return products;
    return products.filter((product) => [product.name, product.sku, product.brand].join(' ').toLowerCase().includes(search));
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((order) => order.status === orderFilter);
  }, [orders, orderFilter]);

  const maxSales = Math.max(...(analytics?.daily || []).map((row) => Number(row.sales || 0)), 1);

  const resetProductForm = () => {
    setProductForm({
      ...emptyProduct,
      categoryId: categories[0]?.id || '',
      categorySlug: categories[0]?.slug || ''
    });
  };

  const editProduct = (product) => {
    setProductForm({
      ...emptyProduct,
      ...product,
      categoryId: product.categoryId || product.category?.id || '',
      categorySlug: product.category?.slug || '',
      comparePrice: product.comparePrice || '',
      gallery: product.gallery || [],
      specifications: product.specifications || {}
    });
    setTab('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadProductImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const response = await adminApi.uploadImage(file);
      setProductForm((current) => ({ ...current, image: response.url, gallery: [...new Set([response.url, ...(current.gallery || [])])] }));
      setNotice('Imagen subida correctamente.');
    } catch (uploadError) {
      setError(uploadError.message || 'No pudimos subir la imagen.');
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const selectedCategory = categories.find((category) => category.id === productForm.categoryId);
      const payload = {
        ...productForm,
        categorySlug: selectedCategory?.slug || productForm.categorySlug,
        price: Number(productForm.price || 0),
        comparePrice: productForm.comparePrice === '' ? null : Number(productForm.comparePrice),
        stock: Number(productForm.stock || 0),
        stockMinimum: Number(productForm.stockMinimum || 0),
        gallery: [...new Set([productForm.image, ...(productForm.gallery || [])].filter(Boolean))],
        specifications: productForm.specifications || {}
      };

      if (productForm.id) await adminApi.updateProduct({ id: productForm.id, payload });
      else await adminApi.createProduct(payload);

      setNotice(productForm.id ? 'Producto actualizado.' : 'Producto creado.');
      resetProductForm();
      await load();
    } catch (saveError) {
      setError(saveError.message || 'No pudimos guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`¿Desactivar ${product.name}?`)) return;
    try {
      await adminApi.deleteProduct(product.id);
      setNotice('Producto desactivado.');
      await load();
    } catch (deleteError) {
      setError(deleteError.message || 'No pudimos desactivar el producto.');
    }
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await adminApi.createCategory(categoryForm);
      setCategoryForm(emptyCategory);
      setNotice('Categoría creada.');
      await load();
    } catch (categoryError) {
      setError(categoryError.message || 'No pudimos crear la categoría.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`¿Eliminar la categoría ${category.name}?`)) return;
    try {
      await adminApi.deleteCategory(category.id);
      await load();
    } catch (categoryError) {
      setError(categoryError.message || 'No pudimos eliminar la categoría.');
    }
  };

  const updateOrder = async (order, status) => {
    try {
      await adminApi.updateOrderStatus({ id: order.id, status });
      setNotice(`Pedido actualizado a ${statusLabel(status)}.`);
      await load();
    } catch (orderError) {
      setError(orderError.message || 'No pudimos actualizar el pedido.');
    }
  };

  const updateTicket = async (ticket, status) => {
    try {
      await adminApi.updateTicketStatus({ id: ticket.id, status });
      setNotice(`Ticket ${ticket.number} actualizado.`);
      await load();
    } catch (ticketError) {
      setError(ticketError.message || 'No pudimos actualizar el ticket.');
    }
  };

  const updatePayment = async (payment, status) => {
    try {
      await adminApi.updatePaymentStatus({ id: payment.id, status });
      setNotice(`Pago actualizado a ${status}.`);
      await load();
    } catch (paymentError) {
      setError(paymentError.message || 'No pudimos actualizar el pago.');
    }
  };

  const openConversation = async (conversation) => {
    try {
      const full = await assistantApi.conversation(conversation.id);
      setSelectedConversation(full);
    } catch (conversationError) {
      setError(conversationError.message || 'No pudimos abrir la conversación.');
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    const clean = reply.trim();
    if (!clean || !selectedConversation) return;
    try {
      await assistantApi.adminReply(selectedConversation.id, clean);
      setReply('');
      const full = await assistantApi.conversation(selectedConversation.id);
      setSelectedConversation(full);
      await load();
    } catch (replyError) {
      setError(replyError.message || 'No pudimos enviar la respuesta.');
    }
  };

  const setConversationStatus = async (status) => {
    if (!selectedConversation) return;
    try {
      await assistantApi.adminStatus(selectedConversation.id, status);
      const full = await assistantApi.conversation(selectedConversation.id);
      setSelectedConversation(full);
      await load();
    } catch (statusError) {
      setError(statusError.message || 'No pudimos actualizar la conversación.');
    }
  };

  return (
    <main className="admin-page-v2">
      <div className="admin-shell-v2">
        <aside className="admin-sidebar-v2">
          <div className="admin-sidebar-v2__brand"><span>Materiales FZAC</span><h1>Administración</h1></div>
          <nav>
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon /> {label}</button>
            ))}
          </nav>
          <div className="admin-sidebar-v2__spacer" />
          <button type="button" onClick={load}><FiRefreshCw /> Actualizar datos</button>
        </aside>

        <section className="admin-main-v2">
          <header className="admin-top-v2">
            <div><span className="kicker">Panel operativo</span><h2>{navItems.find((item) => item.id === tab)?.label}</h2></div>
            <div className="admin-top-v2__status"><FiActivity /> Datos conectados al backend</div>
          </header>

          {(error || notice) && <div className={error ? 'admin-alert-v2 error' : 'admin-alert-v2'}>{error || notice}<button type="button" onClick={() => { setError(''); setNotice(''); }}><FiX /></button></div>}
          {loading && <div className="admin-card-v2"><p>Cargando panel...</p></div>}

          {!loading && tab === 'dashboard' && (
            <>
              <div className="admin-metrics-v2">
                <article className="admin-metric-v2"><FiShoppingBag /><span>Pedidos</span><strong>{metrics?.orders?.total || 0}</strong></article>
                <article className="admin-metric-v2"><FiPackage /><span>Pendientes</span><strong>{metrics?.orders?.pending || 0}</strong></article>
                <article className="admin-metric-v2"><FiBarChart2 /><span>Ventas confirmadas</span><strong>{currency(metrics?.sales?.total || 0)}</strong></article>
                <article className="admin-metric-v2"><FiUsers /><span>Clientes</span><strong>{metrics?.customers?.total || 0}</strong></article>
              </div>

              <div className="admin-grid-v2">
                <article className="admin-card-v2">
                  <div className="admin-card-v2__head"><div><h3>Ventas de los últimos 30 días</h3><p>Ingresos confirmados por fecha.</p></div></div>
                  <div className="admin-chart-v2">
                    {(analytics?.daily || []).map((row) => (
                      <div key={row.date} className="admin-chart-v2__bar" style={{ height: `${Math.max(4, (Number(row.sales || 0) / maxSales) * 100)}%` }} data-value={`${row.date}: ${currency(row.sales)}`} />
                    ))}
                  </div>
                </article>

                <article className="admin-card-v2">
                  <div className="admin-card-v2__head"><div><h3>Alertas de stock</h3><p>Productos que requieren reposición.</p></div></div>
                  <div className="admin-mini-list-v2">
                    {(metrics?.lowStockProducts || []).map((product) => (
                      <div key={product.id}><FiAlertTriangle /><div><strong>{product.name}</strong><span>{product.stock} unidades · {product.sku}</span></div></div>
                    ))}
                    {!metrics?.lowStockProducts?.length && <p>Sin alertas de stock.</p>}
                  </div>
                </article>
              </div>

              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Pedidos recientes</h3><p>Últimos movimientos del comercio.</p></div><button className="btn secondary" type="button" onClick={() => setTab('orders')}>Ver pedidos</button></div>
                <div className="admin-table-wrap-v2">
                  <table className="admin-table-v2"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>{(metrics?.latestOrders || []).map((order) => <tr key={order.id}><td>{order.id.slice(0, 8)}</td><td>{order.customerName}</td><td>{statusLabel(order.status)}</td><td>{currency(order.total)}</td></tr>)}</tbody></table>
                </div>
              </article>
            </>
          )}

          {!loading && tab === 'orders' && (
            <article className="admin-card-v2">
              <div className="admin-card-v2__head admin-card-v2__head--wrap">
                <div><h3>Gestión de pedidos</h3><p>Actualizá preparación, retiro, envío y entrega.</p></div>
                <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="all">Todos los estados</option>{orderStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select>
              </div>
              <div className="admin-table-wrap-v2">
                <table className="admin-table-v2"><thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th>Pago</th><th>Total</th><th>Estado</th></tr></thead><tbody>{filteredOrders.map((order) => <tr key={order.id}><td><strong>{order.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleDateString('es-AR')}</small></td><td><strong>{order.customerName}</strong><small>{order.customerEmail}</small></td><td>{order.shippingMethod}</td><td>{order.payment?.status || 'PENDING'}</td><td>{currency(order.total)}</td><td><select value={order.status} onChange={(event) => updateOrder(order, event.target.value)}>{orderStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></td></tr>)}</tbody></table>
              </div>
            </article>
          )}

          {!loading && tab === 'tickets' && (
            <article className="admin-card-v2">
              <div className="admin-card-v2__head">
                <div><h3>Tickets de compra</h3><p>Comprobantes internos emitidos cuando el pago queda aprobado.</p></div>
              </div>
              <div className="admin-table-wrap-v2">
                <table className="admin-table-v2"><thead><tr><th>Ticket</th><th>Cliente</th><th>Pedido</th><th>Total</th><th>Estado</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.number}</strong><small>{new Date(ticket.issuedAt).toLocaleString('es-AR')}</small></td><td><strong>{ticket.customerName}</strong><small>{ticket.customerEmail}</small></td><td>{ticket.orderId.slice(0, 8).toUpperCase()}</td><td>{currency(ticket.total)}</td><td><select value={ticket.status} onChange={(event) => updateTicket(ticket, event.target.value)}><option value="ISSUED">Emitido</option><option value="PRINTED">Impreso</option><option value="CANCELLED">Cancelado</option></select></td></tr>)}</tbody></table>
              </div>
            </article>
          )}

          {!loading && tab === 'payments' && (
            <article className="admin-card-v2">
              <div className="admin-card-v2__head">
                <div><h3>Pagos</h3><p>Estados de Mercado Pago y validaciones manuales controladas.</p></div>
              </div>
              <div className="admin-table-wrap-v2">
                <table className="admin-table-v2"><thead><tr><th>Pago</th><th>Proveedor</th><th>Pedido</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{payment.id.slice(0, 8).toUpperCase()}</strong><small>{payment.providerPaymentIntentId || payment.providerSessionId || 'Sin referencia'}</small></td><td>{payment.provider}</td><td>{payment.orderId.slice(0, 8).toUpperCase()}</td><td>{currency(payment.amount)}</td><td><select value={payment.status} onChange={(event) => updatePayment(payment, event.target.value)}><option value="PENDING">Pendiente</option><option value="PAID">Aprobado</option><option value="FAILED">Fallido</option><option value="EXPIRED">Expirado</option><option value="REFUNDED">Reintegrado</option></select></td></tr>)}</tbody></table>
              </div>
            </article>
          )}

          {!loading && tab === 'products' && (
            <>
              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>{productForm.id ? 'Editar producto' : 'Crear producto'}</h3><p>CRUD conectado a Prisma y Cloudinary.</p></div>{productForm.id && <button className="btn secondary" type="button" onClick={resetProductForm}><FiX /> Cancelar edición</button>}</div>
                <form className="admin-form-grid-v2" onSubmit={saveProduct}>
                  <input placeholder="Nombre" value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required />
                  <input placeholder="SKU" value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} required />
                  <select value={productForm.categoryId} onChange={(event) => setProductForm({ ...productForm, categoryId: event.target.value })} required><option value="">Categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                  <input placeholder="Subcategoría" value={productForm.subcategory} onChange={(event) => setProductForm({ ...productForm, subcategory: event.target.value })} />
                  <input placeholder="Marca" value={productForm.brand} onChange={(event) => setProductForm({ ...productForm, brand: event.target.value })} />
                  <input placeholder="Unidad" value={productForm.unit} onChange={(event) => setProductForm({ ...productForm, unit: event.target.value })} />
                  <input type="number" min="0" placeholder="Precio" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required />
                  <input type="number" min="0" placeholder="Precio anterior" value={productForm.comparePrice} onChange={(event) => setProductForm({ ...productForm, comparePrice: event.target.value })} />
                  <input type="number" min="0" placeholder="Stock" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} />
                  <input type="number" min="0" placeholder="Stock mínimo" value={productForm.stockMinimum} onChange={(event) => setProductForm({ ...productForm, stockMinimum: event.target.value })} />
                  <input className="admin-form-grid-v2__wide" placeholder="URL imagen" value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} />
                  <label className="admin-upload-v2"><FiUpload /> {saving ? 'Subiendo...' : 'Subir imagen'}<input type="file" accept="image/*" onChange={uploadProductImage} /></label>
                  <textarea placeholder="Descripción" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} />
                  <label className="admin-check-v2"><input type="checkbox" checked={productForm.active} onChange={(event) => setProductForm({ ...productForm, active: event.target.checked })} /> Activo</label>
                  <label className="admin-check-v2"><input type="checkbox" checked={productForm.featured} onChange={(event) => setProductForm({ ...productForm, featured: event.target.checked })} /> Destacado</label>
                  <label className="admin-check-v2"><input type="checkbox" checked={productForm.onSale} onChange={(event) => setProductForm({ ...productForm, onSale: event.target.checked })} /> En oferta</label>
                  <button className="btn" type="submit" disabled={saving}>{productForm.id ? <FiSave /> : <FiPlus />} {productForm.id ? 'Guardar cambios' : 'Crear producto'}</button>
                </form>
              </article>

              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Catálogo</h3><p>{products.length} productos registrados.</p></div><input className="admin-search-v2" placeholder="Buscar producto..." value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div>
                <div className="admin-table-wrap-v2"><table className="admin-table-v2"><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product.id}><td><div className="admin-product-cell-v2"><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.sku} · {product.brand}</small></div></div></td><td>{currency(product.price)}</td><td>{product.stock}</td><td>{product.active ? 'Activo' : 'Inactivo'}</td><td><div className="admin-row-actions-v2"><button type="button" onClick={() => editProduct(product)}><FiEdit2 /></button><button type="button" onClick={() => deleteProduct(product)}><FiTrash2 /></button></div></td></tr>)}</tbody></table></div>
              </article>
            </>
          )}

          {!loading && tab === 'categories' && (
            <div className="admin-grid-v2">
              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Nueva categoría</h3><p>Organizá el catálogo por rubros.</p></div></div>
                <form className="admin-form-grid-v2 admin-form-grid-v2--single" onSubmit={saveCategory}>
                  <input placeholder="Nombre" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required />
                  <input placeholder="Slug opcional" value={categoryForm.slug} onChange={(event) => setCategoryForm({ ...categoryForm, slug: event.target.value })} />
                  <input placeholder="URL de imagen" value={categoryForm.image} onChange={(event) => setCategoryForm({ ...categoryForm, image: event.target.value })} />
                  <input type="number" placeholder="Orden" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })} />
                  <textarea placeholder="Descripción" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} />
                  <button className="btn" type="submit" disabled={saving}><FiPlus /> Crear categoría</button>
                </form>
              </article>

              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Categorías activas</h3><p>Eliminación protegida si contiene productos.</p></div></div>
                <div className="admin-mini-list-v2">{categories.map((category) => <div key={category.id}><div><strong>{category.name}</strong><span>{category.productsCount || 0} productos · /{category.slug}</span></div><button type="button" onClick={() => deleteCategory(category)}><FiTrash2 /></button></div>)}</div>
              </article>
            </div>
          )}

          {!loading && tab === 'customers' && (
            <article className="admin-card-v2">
              <div className="admin-card-v2__head"><div><h3>Clientes registrados</h3><p>Cuentas, pedidos y carritos asociados.</p></div></div>
              <div className="admin-table-wrap-v2"><table className="admin-table-v2"><thead><tr><th>Cliente</th><th>Teléfono</th><th>Pedidos</th><th>Carrito</th><th>Registro</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.email}</small></td><td>{customer.phone || 'Sin teléfono'}</td><td>{customer.ordersCount}</td><td>{customer.cartItemsCount}</td><td>{new Date(customer.createdAt).toLocaleDateString('es-AR')}</td></tr>)}</tbody></table></div>
            </article>
          )}

          {!loading && tab === 'analytics' && (
            <div className="admin-grid-v2">
              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Conversión por producto</h3><p>Vistas, carritos y favoritos.</p></div></div>
                <div className="admin-table-wrap-v2"><table className="admin-table-v2"><thead><tr><th>Producto</th><th>Vistas</th><th>Carrito</th><th>Favoritos</th><th>Checkout</th></tr></thead><tbody>{(analytics?.products || []).map((product) => <tr key={product.productId}><td><strong>{product.name}</strong><small>{product.sku}</small></td><td>{product.views}</td><td>{product.addToCart}</td><td>{product.favorites}</td><td>{product.checkout}</td></tr>)}</tbody></table></div>
              </article>
              <article className="admin-card-v2">
                <div className="admin-card-v2__head"><div><h3>Búsquedas frecuentes</h3><p>Detectá demanda y consultas sin resultados.</p></div></div>
                <div className="admin-mini-list-v2">{(analytics?.searches || []).map((search) => <div key={search.query}><div><strong>{search.query}</strong><span>{search.count} búsquedas</span></div>{search.zeroResults > 0 && <b>{search.zeroResults} sin resultados</b>}</div>)}</div>
              </article>
            </div>
          )}

          {!loading && tab === 'chats' && (
            <article className="admin-card-v2">
              <div className="admin-card-v2__head"><div><h3>Asistencia al cliente</h3><p>Conversaciones del bot y solicitudes a administradores.</p></div></div>
              <div className="admin-chat-v2">
                <div className="admin-chat-v2__list">
                  {conversations.map((conversation) => <button key={conversation.id} type="button" className={selectedConversation?.id === conversation.id ? 'active' : ''} onClick={() => openConversation(conversation)}><strong>{conversation.user?.name || conversation.subject || 'Visitante'}</strong><span>{conversation.channel} · {conversation.status}</span></button>)}
                </div>
                <div className="admin-chat-v2__messages">
                  {selectedConversation ? (
                    <>
                      <div className="admin-chat-v2__status"><select value={selectedConversation.status} onChange={(event) => setConversationStatus(event.target.value)}><option value="OPEN">Abierta</option><option value="WAITING_ADMIN">Esperando admin</option><option value="RESOLVED">Resuelta</option><option value="CLOSED">Cerrada</option></select></div>
                      <div className="admin-chat-v2__stream">{(selectedConversation.messages || []).map((item) => <article key={item.id} className={item.role === 'ADMIN' ? 'admin' : item.role === 'USER' ? 'user' : ''}><small>{item.role}</small><p>{item.content}</p></article>)}</div>
                      <form className="admin-chat-v2__composer" onSubmit={sendReply}><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Responder al cliente..." /><button className="btn" type="submit">Enviar</button></form>
                    </>
                  ) : <div className="admin-chat-empty-v2"><FiMessageCircle /><p>Seleccioná una conversación.</p></div>}
                </div>
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
};
