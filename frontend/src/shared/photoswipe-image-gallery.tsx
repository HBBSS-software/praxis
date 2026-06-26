import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode, useCallback, useRef } from 'react';
import PhotoSwipe, { type DataSourceArray, type SlideData } from 'photoswipe';
import 'photoswipe/style.css';

import { resolveAuthenticatedImageSrc } from '@/shared/authenticated-image';
import { cn } from '@/lib/utils';

type ImageSize = {
  width: number;
  height: number;
};

export type PhotoSwipeGalleryImage = {
  src: string;
  alt?: string;
  downloadName?: string;
};

type PreviewProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: (element: HTMLAnchorElement | null) => void;
};

function loadImageSize(src: string) {
  return new Promise<ImageSize>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1
      });
    };
    image.onerror = reject;
    image.src = src;
  });
}

function getDownloadName(src: string, index: number) {
  try {
    const url = new URL(src, window.location.href);
    const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
    return name || `image-${index + 1}`;
  } catch {
    return `image-${index + 1}`;
  }
}

function createDownloadIcon() {
  return {
    isCustomSVG: true,
    inner: '<path id="pswp__icn-download" d="M14.5 7h3v10.8l3.9-3.9 2.1 2.1L16 23.5 8.5 16l2.1-2.1 3.9 3.9V7Zm-5 18h13v3h-13v-3Z"/>',
    outlineID: 'pswp__icn-download'
  };
}

export function PhotoSwipeImageGallery({
  images,
  className,
  children
}: {
  images: PhotoSwipeGalleryImage[];
  className?: string;
  children: (params: {
    image: PhotoSwipeGalleryImage;
    index: number;
    previewProps: PreviewProps;
  }) => ReactNode;
}) {
  const imageElementsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const sizeCacheRef = useRef(new Map<string, Promise<ImageSize> | ImageSize>());
  const openingRef = useRef(false);

  const getImageSize = useCallback((src: string) => {
    const cached = sizeCacheRef.current.get(src);

    if (cached) {
      return Promise.resolve(cached);
    }

    const pending = loadImageSize(src)
      .catch(() => ({ width: 1600, height: 1200 }))
      .then((size) => {
        sizeCacheRef.current.set(src, size);
        return size;
      });

    sizeCacheRef.current.set(src, pending);
    return pending;
  }, []);

  const openImage = useCallback(async (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();

    if (openingRef.current || index < 0 || index >= images.length) {
      return;
    }

    openingRef.current = true;

    try {
      const dataSource = await Promise.all(
        images.map(async (image, imageIndex): Promise<SlideData> => {
          const src = resolveAuthenticatedImageSrc(image.src);
          const size = await getImageSize(src);
          const downloadName = image.downloadName ?? getDownloadName(src, imageIndex);

          return {
            src,
            width: size.width,
            height: size.height,
            alt: image.alt,
            msrc: src,
            element: imageElementsRef.current[imageIndex] ?? undefined,
            downloadUrl: src,
            downloadName
          };
        })
      );

      const pswp = new PhotoSwipe({
        dataSource: dataSource as DataSourceArray,
        index,
        bgOpacity: 0.9,
        showHideAnimationType: 'zoom',
        imageClickAction: 'zoom-or-close',
        bgClickAction: 'close',
        tapAction: 'toggle-controls',
        doubleTapAction: 'zoom',
        errorMsg: '图片加载失败',
        closeTitle: '关闭',
        zoomTitle: '缩放',
        arrowPrevTitle: '上一张',
        arrowNextTitle: '下一张'
      });

      let downloadButton: HTMLAnchorElement | null = null;
      const syncDownloadButton = () => {
        if (!downloadButton) {
          return;
        }

        const item = dataSource[pswp.currIndex] as SlideData | undefined;
        const href = typeof item?.downloadUrl === 'string' ? item.downloadUrl : item?.src;
        const downloadName = typeof item?.downloadName === 'string' ? item.downloadName : getDownloadName(href ?? '', pswp.currIndex);

        if (href) {
          downloadButton.href = href;
          downloadButton.setAttribute('download', downloadName);
          downloadButton.removeAttribute('aria-disabled');
        } else {
          downloadButton.removeAttribute('href');
          downloadButton.setAttribute('aria-disabled', 'true');
        }
      };

      pswp.on('uiRegister', () => {
        pswp.ui?.registerElement({
          name: 'download',
          className: 'pswp__button--download',
          tagName: 'a',
          isButton: true,
          order: 8,
          title: '下载图片',
          ariaLabel: '下载图片',
          html: createDownloadIcon(),
          onInit: (element) => {
            downloadButton = element as HTMLAnchorElement;
            syncDownloadButton();
          }
        });
      });
      pswp.on('change', syncDownloadButton);
      pswp.init();
    } finally {
      openingRef.current = false;
    }
  }, [getImageSize, images]);

  return (
    <div className={cn(className)}>
      {images.map((image, index) => {
        const resolvedSrc = resolveAuthenticatedImageSrc(image.src);

        return children({
          image,
          index,
          previewProps: {
            ref: (element) => {
              imageElementsRef.current[index] = element;
            },
            href: resolvedSrc,
            target: '_blank',
            rel: 'noreferrer',
            onClick: (event) => void openImage(event, index)
          }
        });
      })}
    </div>
  );
}
