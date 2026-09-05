import type { ReactNode } from 'react'
import type { ImageUploaderProps, ImageUploadItem } from 'antd-mobile'
import { ImageUploader, ImageViewer } from 'antd-mobile'
import { UploadOutline } from 'antd-mobile-icons'
import { showToast } from '../Feedback'
import './CampusImageUploader.css'

interface CampusImageUploaderProps
  extends Omit<
    ImageUploaderProps,
    | 'accept'
    | 'beforeUpload'
    | 'children'
    | 'maxCount'
    | 'onChange'
    | 'onCountExceed'
    | 'onPreview'
    | 'upload'
    | 'value'
  > {
  children?: ReactNode
  maxCount?: number
  maxSizeMB?: number
  onChange: (items: ImageUploadItem[]) => void
  upload: (file: File) => Promise<ImageUploadItem>
  value: ImageUploadItem[]
}

export function CampusImageUploader({
  children,
  className,
  maxCount = 6,
  maxSizeMB = 20,
  onChange,
  upload,
  value,
  ...props
}: CampusImageUploaderProps) {
  const beforeUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error')
      return null
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      showToast(`单张图片不能超过 ${maxSizeMB}MB`, 'error')
      return null
    }

    return file
  }

  return (
    <ImageUploader
      accept="image/*"
      beforeUpload={beforeUpload}
      className={['campus-image-uploader', className].filter(Boolean).join(' ')}
      maxCount={maxCount}
      onChange={onChange}
      onCountExceed={(exceed) =>
        showToast(`最多上传 ${maxCount} 张图片，还需移除 ${exceed} 张`, 'error')
      }
      onPreview={(index) =>
        ImageViewer.Multi.show({
          defaultIndex: index,
          images: value.map((item) => item.url),
        })
      }
      upload={upload}
      value={value}
      {...props}
    >
      {children ?? (
        <span className="campus-image-uploader__trigger">
          <UploadOutline aria-hidden />
          <span>上传图片</span>
        </span>
      )}
    </ImageUploader>
  )
}
