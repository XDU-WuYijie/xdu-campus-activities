import type { ImageProps } from 'antd-mobile'
import { Image, ImageViewer } from 'antd-mobile'
import { PictureOutline, PictureWrongOutline } from 'antd-mobile-icons'
import './CampusImage.css'

interface CampusImageProps extends Omit<ImageProps, 'alt' | 'fallback' | 'src'> {
  alt: string
  fallbackText?: string
  preview?: boolean
  previewIndex?: number
  previewSources?: string[]
  src?: string
}

export function CampusImage({
  alt,
  className,
  fallbackText = '图片加载失败',
  preview = false,
  previewIndex = 0,
  previewSources,
  src,
  ...props
}: CampusImageProps) {
  const image = (
    <Image
      alt={alt}
      className={['campus-image', className].filter(Boolean).join(' ')}
      fallback={
        <span className="campus-image__fallback" role="img" aria-label={fallbackText}>
          <PictureWrongOutline aria-hidden />
          <span>{fallbackText}</span>
        </span>
      }
      placeholder={
        <span className="campus-image__placeholder" aria-hidden>
          <PictureOutline />
        </span>
      }
      src={src}
      {...props}
    />
  )

  if (!preview || !src) {
    return image
  }

  const sources = previewSources?.length ? previewSources : [src]

  return (
    <button
      aria-label={`预览图片：${alt}`}
      className="campus-image__preview-trigger"
      onClick={() =>
        ImageViewer.Multi.show({
          defaultIndex: Math.min(previewIndex, sources.length - 1),
          images: sources,
        })
      }
      type="button"
    >
      {image}
    </button>
  )
}
