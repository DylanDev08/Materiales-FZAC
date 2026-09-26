import "server-only";

import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getEnv, hasRealValue } from "@/lib/utils/env";
import type { Tables } from "@/types/supabase";

const PAGE_SIZE = 30;

export type SupplierDirectoryEntry = Tables<"suppliers"> & {
  productCount: number;
  documentCount: number;
};

export type SupplierWorkspaceProduct = {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  active: boolean;
  stock: number;
  availabilityStatus: string;
  customerPrice: number;
  supplierPrice: number;
  grossProfit: number;
  markupPercent: number;
};

export type SupplierDocumentItem = Tables<"supplier_document_items"> & {
  product: { id: string; name: string; sku: string; price: number } | null;
};

export type SupplierDocument = Tables<"supplier_documents"> & {
  items: SupplierDocumentItem[];
};

export type SupplierWorkspaceData = {
  ready: boolean;
  suppliers: SupplierDirectoryEntry[];
  selectedSupplier: SupplierDirectoryEntry | null;
  products: SupplierWorkspaceProduct[];
  documents: SupplierDocument[];
  query: string;
  page: number;
  pageSize: number;
  totalProducts: number;
};

type SourceRow = {
  product_id: string;
  original_name: string;
  source_sku: string | null;
  original_price: number | string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    active: boolean;
    stock: number | string | null;
    availability_status: string | null;
    price: number | string;
  } | null;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeSearch(value: string | undefined) {
  return (value ?? "").trim().slice(0, 80).replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ");
}

function empty(): SupplierWorkspaceData {
  return {
    ready: false,
    suppliers: [],
    selectedSupplier: null,
    products: [],
    documents: [],
    query: "",
    page: 1,
    pageSize: PAGE_SIZE,
    totalProducts: 0
  };
}

export async function getSupplierWorkspace({
  supplierId,
  query,
  page
}: {
  supplierId?: string;
  query?: string;
  page?: number;
} = {}): Promise<SupplierWorkspaceData> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    const backend = getEnv("API_PROXY_ORIGIN");
    if (hasRealValue(backend)) {
      try {
        const cookieStore = await cookies();
        const cookieHeader = cookieStore.getAll().map((item) => `${item.name}=${item.value}`).join("; ");
        const url = new URL("/api/admin/supplier-workspace", backend);
        if (supplierId) url.searchParams.set("supplier", supplierId);
        if (query) url.searchParams.set("q", query);
        if (page) url.searchParams.set("page", String(page));
        const response = await fetch(url, {
          headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
          cache: "no-store"
        });
        if (response.ok) return await response.json() as SupplierWorkspaceData;
      } catch {
        // Fall through to the authenticated Supabase client when backend proxying is unavailable.
      }
    }

    const session = await getSupabaseServerClient();
    if (!session) return empty();
    return getSupplierWorkspaceWithClient(session, { supplierId, query, page });
  }

  return getSupplierWorkspaceWithClient(admin, { supplierId, query, page });
}

async function getSupplierWorkspaceWithClient(
  db: NonNullable<ReturnType<typeof getSupabaseAdminClient>> | NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
  {
    supplierId,
    query,
    page
  }: {
    supplierId?: string;
    query?: string;
    page?: number;
  }
): Promise<SupplierWorkspaceData> {

  const suppliersResult = await db.from("suppliers").select("*")
    .order("active", { ascending: false }).order("name").limit(100);
  if (suppliersResult.error) return empty();
  const suppliers = (suppliersResult.data ?? []) as Tables<"suppliers">[];

  const counts = await Promise.all(suppliers.map(async (supplier) => {
    const [products, documents] = await Promise.all([
      db.from("product_supplier_sources").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id),
      db.from("supplier_documents").select("id", { count: "exact", head: true }).eq("supplier_id", supplier.id).eq("status", "ACTIVE")
    ]);
    return {
      ...supplier,
      productCount: products.count ?? 0,
      documentCount: documents.count ?? 0
    } satisfies SupplierDirectoryEntry;
  }));

  const selectedSupplier = counts.find((supplier) => supplier.id === supplierId) ?? counts[0] ?? null;
  if (!selectedSupplier) return { ...empty(), ready: true, suppliers: counts };

  const normalizedQuery = safeSearch(query);
  const normalizedPage = Math.max(1, Math.floor(page || 1));
  const from = (normalizedPage - 1) * PAGE_SIZE;
  let productsQuery = db.from("product_supplier_sources")
    .select("product_id,original_name,source_sku,original_price,product:products(id,name,sku,unit,active,stock,availability_status,price)", { count: "exact" })
    .eq("supplier_id", selectedSupplier.id)
    .order("original_name", { ascending: true });
  if (normalizedQuery) {
    productsQuery = productsQuery.or(`original_name.ilike.%${normalizedQuery}%,source_sku.ilike.%${normalizedQuery}%`);
  }

  const [productsResult, documentsResult] = await Promise.all([
    productsQuery.range(from, from + PAGE_SIZE - 1),
    db.from("supplier_documents")
      .select("*,items:supplier_document_items(*,product:products(id,name,sku,price))")
      .eq("supplier_id", selectedSupplier.id)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  if (productsResult.error || documentsResult.error) {
    return { ...empty(), suppliers: counts, selectedSupplier };
  }

  const products = ((productsResult.data ?? []) as unknown as SourceRow[]).map((source) => {
    const customerPrice = numeric(source.product?.price);
    const supplierPrice = numeric(source.original_price);
    const grossProfit = customerPrice - supplierPrice;
    return {
      productId: source.product_id,
      name: source.product?.name ?? source.original_name,
      sku: source.product?.sku ?? source.source_sku ?? "-",
      unit: source.product?.unit ?? "unidad",
      active: Boolean(source.product?.active),
      stock: numeric(source.product?.stock),
      availabilityStatus: source.product?.availability_status ?? "CONSULT",
      customerPrice,
      supplierPrice,
      grossProfit,
      markupPercent: supplierPrice > 0 ? (grossProfit / supplierPrice) * 100 : 0
    } satisfies SupplierWorkspaceProduct;
  });

  return {
    ready: true,
    suppliers: counts,
    selectedSupplier,
    products,
    documents: (documentsResult.data ?? []) as unknown as SupplierDocument[],
    query: normalizedQuery,
    page: normalizedPage,
    pageSize: PAGE_SIZE,
    totalProducts: productsResult.count ?? products.length
  };
}
