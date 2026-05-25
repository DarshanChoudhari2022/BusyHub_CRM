export function getOptimizedUrl(originalUrl: string | null, width = 300): string | undefined {
  if (!originalUrl) return undefined;
  
  // Skip optimization for local blob URLs or base64
  if (originalUrl.startsWith('blob:') || originalUrl.startsWith('data:')) {
    return originalUrl;
  }

  // Use a reliable open-source image proxy (images.weserv.nl) to compress and resize 
  // the image on the fly. This avoids needing Supabase Pro Image Transformations enabled
  // and dramatically reduces payload size for faster loading.
  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://images.weserv.nl/?url=${encodedUrl}&w=${width}&q=70&output=webp`;
}
