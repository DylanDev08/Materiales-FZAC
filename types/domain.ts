export type UserRole = "USER" | "ADMIN" | "OPERATOR";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_TRANSFER"
  | "PENDING_ADMIN_APPROVAL"
  | "COORDINATE"
  | "PAID"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
export type PaymentProvider = "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP" | "MOCK" | "NARANJAX";
export type PaymentMethod = "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP";
export type PaymentFlow = "CHECKOUT_PRO" | "CARD" | "TRANSFER" | "WHATSAPP";
export type ShippingMethod = "PICKUP" | "DELIVERY";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url?: string | null;
  parent_id?: string | null;
  active: boolean;
  sort_order?: number | null;
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  category_id: string;
  category?: Category | null;
  subcategory: string;
  brand: string;
  price: number;
  compare_price?: number | null;
  stock: number;
  stock_minimum: number;
  unit: string;
  image_url: string;
  gallery: string[];
  specifications: Record<string, string | number | boolean>;
  featured: boolean;
  on_sale: boolean;
  active: boolean;
};

export type CartLine = {
  productId: string;
  quantity: number;
  product: Product;
};

export type AddressPayload = {
  street?: string;
  number?: string;
  apartment?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
};

export type CheckoutPayload = {
  items: Array<{ productId: string; sku?: string; slug?: string; quantity: number }>;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingMethod: ShippingMethod;
  address?: AddressPayload | null;
  notes?: string;
  paymentProvider?: PaymentProvider;
  paymentMethod?: PaymentMethod;
  paymentFlow?: PaymentFlow;
  idempotencyKey?: string;
};

export type AdminMetric = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
};
