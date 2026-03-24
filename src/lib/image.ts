export type ImageResizeOptions = {
  maxWidth: number
  maxHeight: number
  quality: number
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        resolve(result)
        return
      }

      reject(new Error('No se pudo leer el archivo'))
    }

    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export function getImageResizeDims(width: number, height: number, maxWidth: number, maxHeight: number) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const ratio = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight)
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  }
}

export async function resizeImageDataUrl(dataUrl: string, options: ImageResizeOptions): Promise<string> {
  if (typeof window === 'undefined') return dataUrl

  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      const dimensions = getImageResizeDims(image.width, image.height, options.maxWidth, options.maxHeight)
      const canvas = document.createElement('canvas')
      canvas.width = dimensions.width
      canvas.height = dimensions.height

      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }

      context.imageSmoothingEnabled = true
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
      resolve(canvas.toDataURL('image/jpeg', options.quality))
    }
    image.onerror = () => reject(new Error('No se pudo procesar la imagen'))
    image.src = dataUrl
  })
}

export async function createWallpaperPreview(dataUrl: string): Promise<string> {
  try {
    return await resizeImageDataUrl(dataUrl, {
      maxWidth: 320,
      maxHeight: 320,
      quality: 0.78,
    })
  } catch {
    return ''
  }
}

export async function createOptimizedWallpaperDataUrl(dataUrl: string): Promise<string> {
  return resizeImageDataUrl(dataUrl, {
    maxWidth: 1600,
    maxHeight: 1200,
    quality: 0.82,
  })
}
