import slugify from 'slugify';

export const toSlug = (value) => slugify(value, {
  lower: true,
  strict: true,
  locale: 'es'
});
