import React, { useState, useEffect } from 'react';
import { FileImage } from 'lucide-react';

export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  kopi: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=400&auto=format&fit=crop&q=80',
  teh: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
  jus: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&auto=format&fit=crop&q=80',
  cemilan: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&auto=format&fit=crop&q=80'
};

export const getDefaultProductImage = (category?: string, name?: string): string => {
  const cat = (category || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();

  if (cat.includes('kopi') || cat.includes('coffee') || n.includes('latte') || n.includes('espresso') || n.includes('brew')) {
    return DEFAULT_PRODUCT_IMAGES.kopi;
  }
  if (cat.includes('teh') || cat.includes('tea') || n.includes('matcha') || n.includes('earl grey')) {
    return DEFAULT_PRODUCT_IMAGES.teh;
  }
  if (cat.includes('jus') || cat.includes('juice') || cat.includes('buah') || n.includes('smoothie')) {
    return DEFAULT_PRODUCT_IMAGES.jus;
  }
  if (cat.includes('cemilan') || cat.includes('snack') || cat.includes('pastry') || cat.includes('kue') || n.includes('croissant')) {
    return DEFAULT_PRODUCT_IMAGES.cemilan;
  }
  return DEFAULT_PRODUCT_IMAGES.default;
};

export interface ProductImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  containerClassName?: string;
  iconClassName?: string;
  showAltText?: boolean;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  category,
  className = 'w-full h-full object-cover',
  containerClassName = 'w-full h-full relative overflow-hidden',
  iconClassName,
  showAltText = true,
  loading = 'lazy',
  ...props
}) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    setHasError(false);
    setLoaded(false);
  }, [src]);

  // If image is not found (null, empty, or failed to load), use icon 'file-image' from lucide icon
  const isImageNotFound = !src || src.trim() === '' || hasError;

  if (isImageNotFound) {
    return (
      <div
        className={`${containerClassName} flex flex-col items-center justify-center bg-stone-100 dark:bg-stone-850 text-stone-400 dark:text-stone-500 select-none p-1`}
        title={alt ? `${alt} (Image not found)` : 'Image not found'}
        role="img"
        aria-label={alt || 'Image not found'}
        data-testid="file-image-fallback"
      >
        <div className="w-full h-full flex flex-col items-center justify-center min-h-0">
          <FileImage
            className={
              iconClassName ||
              'w-6 h-6 sm:w-8 sm:h-8 text-stone-400 dark:text-stone-500 stroke-[1.75]'
            }
          />
          {showAltText && alt && (
            <span className="text-[9px] sm:text-[10px] font-medium text-stone-500 dark:text-stone-400 mt-1 line-clamp-1 max-w-[90%] px-0.5 text-center hidden sm:block">
              {alt}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {/* Background skeleton while image is loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-stone-100 dark:bg-stone-850 animate-pulse flex items-center justify-center">
          <FileImage className="w-6 h-6 text-stone-300 dark:text-stone-600 animate-pulse stroke-[1.5]" />
        </div>
      )}

      <img
        {...props}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => setHasError(true)}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};
