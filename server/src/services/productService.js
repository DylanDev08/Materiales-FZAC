import { productRepository } from '../repositories/productRepository.js';
import { categoryRepository } from '../repositories/categoryRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { serializeProduct } from '../utils/format.js';
import { toSlug } from '../utils/slug.js';

export const productService = {
  async list(query) {
    const result = await productRepository.list(query);
    return { products: result.items.map(serializeProduct), pagination: { total: result.total, page: result.page, pages: result.pages }, brands: result.brands };
  },

  async detail(slug) {
    const product = await productRepository.findBySlug(slug);
    if (!product) throw new ApiError(404, 'Producto no encontrado');

    const related = await productRepository.related(product);
    return { product: serializeProduct(product), related: related.map(serializeProduct) };
  },

  async create(payload) {
    const category = await categoryRepository.findById(payload.categoryId);
    if (!category) throw new ApiError(400, 'Categoría inválida');

    const slug = payload.slug || toSlug(payload.name);
    const product = await productRepository.create({ ...payload, slug });
    return serializeProduct(product);
  },

  async update(id, payload) {
    const data = { ...payload };
    if (data.name && !data.slug) data.slug = toSlug(data.name);

    const product = await productRepository.update(id, data);
    return serializeProduct(product);
  },

  remove(id) {
    return productRepository.delete(id);
  }
};
