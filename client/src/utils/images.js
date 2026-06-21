export const toWebpImageUrl = (source) => {
  if (!source || typeof source !== 'string') return source || '';

  try {
    const url = new URL(source);

    if (url.hostname.includes('images.unsplash.com')) {
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fm', 'webp');
      url.searchParams.set('q', url.searchParams.get('q') || '86');
      return url.toString();
    }

    if (url.hostname.includes('res.cloudinary.com') && !url.pathname.includes('/f_webp,')) {
      url.pathname = url.pathname.replace('/upload/', '/upload/f_webp,q_auto/');
      return url.toString();
    }
  } catch {
    return source;
  }

  return source;
};
