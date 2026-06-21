import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { cartApi } from '../api/cartApi';
import { productsApi } from '../api/productsApi';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const KEY = 'fzac_cart';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

const normalizeServerItems = (response) => Array.isArray(response?.items) ? response.items : [];
const saveLocal = (items) => localStorage.setItem(KEY, JSON.stringify(items));

const totals = (items) => ({
  count: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
  subtotal: items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.product?.price || item.unitPrice || 0), 0)
});

export const CartProvider = ({ children }) => {
  const { user, isAuthenticated, isCheckingAuth } = useAuth();
  const [items, setItems] = useState(read);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cartError, setCartError] = useState('');
  const [cartNotice, setCartNotice] = useState('');
  const synchronizedUser = useRef('');

  const setAndSave = (nextItems) => {
    setItems(nextItems);
    saveLocal(nextItems);
  };

  useEffect(() => {
    if (isCheckingAuth) return;

    if (!isAuthenticated) {
      synchronizedUser.current = '';
      setItems(read());
      return;
    }

    if (synchronizedUser.current === user?.id) return;
    synchronizedUser.current = user?.id || '';
    let active = true;

    const synchronize = async () => {
      setIsSyncing(true);
      setCartError('');
      const localItems = read();

      try {
        const initialServerCart = await cartApi.get();
        let serverItems = normalizeServerItems(initialServerCart);
        const serverProductIds = new Set(serverItems.map((item) => item.productId));
        let addedLocalItems = false;

        for (const item of localItems) {
          if (!item.productId || !item.quantity || serverProductIds.has(item.productId)) continue;
          await cartApi.add({ productId: item.productId, quantity: Number(item.quantity) });
          serverProductIds.add(item.productId);
          addedLocalItems = true;
        }

        if (addedLocalItems) {
          serverItems = normalizeServerItems(await cartApi.get());
        }

        if (!active) return;
        setAndSave(serverItems);
      } catch (error) {
        if (active) setCartError(error.message || 'No pudimos sincronizar el carrito.');
      } finally {
        if (active) setIsSyncing(false);
      }
    };

    synchronize();
    return () => { active = false; };
  }, [isAuthenticated, isCheckingAuth, user?.id]);

  useEffect(() => {
    if (!cartNotice) return undefined;
    const timer = window.setTimeout(() => setCartNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [cartNotice]);

  const addItem = async (product, quantity = 1) => {
    const requestedQuantity = Math.max(Number(quantity || 1), 1);
    setCartError('');

    if (isAuthenticated) {
      try {
        const response = await cartApi.add({ productId: product.id, quantity: requestedQuantity });
        const serverItems = normalizeServerItems(response);
        setAndSave(serverItems);
        setCartNotice('Producto agregado al carrito');
        productsApi.trackEvent({ productId: product.id, type: 'ADD_TO_CART', metadata: { quantity: requestedQuantity } });
        return { items: serverItems, ...totals(serverItems) };
      } catch (error) {
        setCartError(error.message || 'No pudimos agregar el producto.');
        throw error;
      }
    }

    const existing = items.find((item) => item.productId === product.id);
    const next = existing
      ? items.map((item) => item.productId === product.id ? { ...item, quantity: Number(item.quantity) + requestedQuantity } : item)
      : [...items, { id: product.id, productId: product.id, quantity: requestedQuantity, product }];

    setAndSave(next);
    setCartNotice('Producto agregado al carrito');
    productsApi.trackEvent({ productId: product.id, type: 'ADD_TO_CART', metadata: { quantity: requestedQuantity } });
    return { items: next, ...totals(next) };
  };

  const updateQuantity = async (id, quantity) => {
    const nextQuantity = Math.max(Number(quantity || 1), 1);
    const current = items.find((item) => item.id === id || item.productId === id);
    if (!current) return;

    if (isAuthenticated) {
      const response = await cartApi.update({ itemId: current.id, productId: current.productId, quantity: nextQuantity });
      setAndSave(normalizeServerItems(response));
      return;
    }

    setAndSave(items.map((item) => item.id === id || item.productId === id ? { ...item, quantity: nextQuantity } : item));
  };

  const removeItem = async (id) => {
    const current = items.find((item) => item.id === id || item.productId === id);
    if (!current) return;

    if (isAuthenticated) {
      const response = await cartApi.remove({ itemId: current.id, productId: current.productId });
      setAndSave(normalizeServerItems(response));
      return;
    }

    setAndSave(items.filter((item) => item.id !== id && item.productId !== id));
  };

  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        await cartApi.clear();
      } catch {
        // El carrito local igualmente se limpia luego de una compra confirmada.
      }
    }
    setAndSave([]);
  };

  const calculated = totals(items);
  const value = useMemo(() => ({
    items,
    cartItems: items,
    count: calculated.count,
    cartCount: calculated.count,
    subtotal: calculated.subtotal,
    cartSubtotal: calculated.subtotal,
    isSyncing,
    cartError,
    addItem,
    updateQuantity,
    removeItem,
    clearCart
  }), [items, calculated.count, calculated.subtotal, isSyncing, cartError, isAuthenticated]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {cartNotice && <div className="cart-toast-v2" role="status" aria-live="polite">{cartNotice}</div>}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider');
  return context;
};
