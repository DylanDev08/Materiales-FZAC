import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ScrollToTop } from './components/common/ScrollToTop';

import { Home } from './pages/Home/Home';
import { Catalog } from './pages/Catalog/Catalog';
import { Products } from './pages/Products/Products';
import { Offers } from './pages/Offers/Offers';
import { ProductDetail } from './pages/ProductDetail/ProductDetail';
import { Rubros } from './pages/Rubros/Rubros';
import { Services } from './pages/Services/Services';
import { Contact } from './pages/Contact/Contact';
import { HowToBuy } from './pages/HowToBuy/HowToBuy';

import { Cart } from './pages/Cart/Cart';
import { Checkout } from './pages/Checkout/Checkout';
import { PaymentSuccess } from './pages/PaymentSuccess/PaymentSuccess';
import { PaymentFailure } from './pages/PaymentFailure/PaymentFailure';
import { PaymentPending } from './pages/PaymentPending/PaymentPending';
import { AuthCallback } from './pages/AuthCallback/AuthCallback';

import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import { Account } from './pages/Account/Account';
import { OrdersAccess } from './pages/Orders/OrdersAccess';

import { Admin } from './pages/Admin/Admin';

import { Terms } from './pages/Legal/Terms';
import { Privacy } from './pages/Legal/Privacy';
import { Returns } from './pages/Legal/Returns';
import { PaymentMethods } from './pages/Info/PaymentMethods';
import { ShippingAndPickup } from './pages/Info/ShippingAndPickup';
import { Faq } from './pages/Info/Faq';

import { NotFound } from './pages/NotFound/NotFound';

export default function App() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />


          <Route path="catalog" element={<Navigate to="/catalogo" replace />} />
          <Route path="products" element={<Navigate to="/productos" replace />} />
          <Route path="offers" element={<Navigate to="/ofertas" replace />} />
          <Route path="categories" element={<Navigate to="/categorias" replace />} />
          <Route path="about" element={<Navigate to="/nosotros" replace />} />
          <Route path="cart" element={<Navigate to="/carrito" replace />} />
          <Route path="orders" element={<Navigate to="/pedidos" replace />} />
          <Route path="register" element={<Navigate to="/registro" replace />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="catalogo" element={<Catalog />} />
          <Route path="productos" element={<Products />} />
          <Route path="ofertas" element={<Offers />} />
          <Route path="categorias" element={<Rubros />} />
          <Route path="producto/:slug" element={<ProductDetail />} />
          <Route path="nosotros" element={<Services />} />
          <Route path="servicios" element={<Navigate to="/nosotros" replace />} />
          <Route path="rubros" element={<Navigate to="/categorias" replace />} />
          <Route path="como-comprar" element={<HowToBuy />} />
          <Route path="contacto" element={<Contact />} />

          <Route path="carrito" element={<Cart />} />

          <Route
            path="checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />

          <Route path="pedidos" element={<OrdersAccess />} />

          <Route
            path="cuenta"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />

          <Route path="pago-aprobado" element={<PaymentSuccess />} />
          <Route path="pago-rechazado" element={<PaymentFailure />} />
          <Route path="pago-pendiente" element={<PaymentPending />} />
          <Route path="pago/exitoso" element={<PaymentSuccess />} />
          <Route path="pago/fallido" element={<PaymentFailure />} />
          <Route path="pago/pendiente" element={<PaymentPending />} />

          <Route path="login" element={<Login />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route path="registro" element={<Register />} />

          <Route path="terminos" element={<Terms />} />
          <Route path="terminos-y-condiciones" element={<Terms />} />
          <Route path="privacidad" element={<Privacy />} />
          <Route path="cambios-y-devoluciones" element={<Returns />} />
          <Route path="medios-de-pago" element={<PaymentMethods />} />
          <Route path="envios-y-retiros" element={<ShippingAndPickup />} />
          <Route path="preguntas-frecuentes" element={<Faq />} />

          <Route path="ajustes" element={<Navigate to="/cuenta?tab=settings" replace />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          }
        />

      </Routes>
    </>
  );
}
