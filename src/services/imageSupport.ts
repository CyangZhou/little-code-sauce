export interface ImageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface ImageUploadResult {
  success: boolean;
  image?: ImageAttachment;
  error?: string;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `不支持的图片格式: ${file.type}。支持: PNG, JPEG, GIF, WebP, SVG` 
    };
  }
  
  if (file.size > MAX_IMAGE_SIZE) {
    return { 
      valid: false, 
      error: `图片大小超过限制: ${(file.size / 1024 / 1024).toFixed(2)}MB > 10MB` 
    };
  }
  
  return { valid: true };
}

export async function processImageFile(file: File): Promise<ImageUploadResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      
      const image: ImageAttachment = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        thumbnail: dataUrl,
      };

      if (file.type !== 'image/svg+xml') {
        const img = new Image();
        img.onload = () => {
          image.width = img.width;
          image.height = img.height;
          
          const maxSize = 200;
          if (img.width > maxSize || img.height > maxSize) {
            const ratio = Math.min(maxSize / img.width, maxSize / img.height);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              image.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
            }
          }
          
          resolve({ success: true, image });
        };
        img.onerror = () => {
          resolve({ success: false, error: '图片加载失败' });
        };
        img.src = dataUrl;
      } else {
        resolve({ success: true, image });
      }
    };
    
    reader.onerror = () => {
      resolve({ success: false, error: '文件读取失败' });
    };
    
    reader.readAsDataURL(file);
  });
}

export function formatImageForPrompt(image: ImageAttachment): string {
  const sizeKB = (image.size / 1024).toFixed(1);
  const dimensions = image.width && image.height ? `${image.width}x${image.height}` : '未知';
  
  return `[图片: ${image.name}]
尺寸: ${dimensions}
大小: ${sizeKB} KB
类型: ${image.type}
[图片数据已包含在消息中]`;
}

export function formatImagesForPrompt(images: ImageAttachment[]): string {
  if (images.length === 0) return '';
  
  const formatted = images.map(formatImageForPrompt).join('\n\n');
  return `\n--- 附件图片 ---\n${formatted}\n--- 图片结束 ---\n\n`;
}

export class ImageDropHandler {
  private onDrop: (images: ImageAttachment[]) => void;
  private dragOver: boolean = false;

  constructor(onDrop: (images: ImageAttachment[]) => void) {
    this.onDrop = onDrop;
  }

  handleDragOver = (e: DragEvent): boolean => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer?.types.includes('Files')) {
      this.dragOver = true;
      return true;
    }
    return false;
  };

  handleDragLeave = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.dragOver = false;
  };

  handleDrop = async (e: DragEvent): Promise<ImageAttachment[]> => {
    e.preventDefault();
    e.stopPropagation();
    this.dragOver = false;

    const files = Array.from(e.dataTransfer?.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      return [];
    }

    const results = await Promise.all(
      imageFiles.map(f => processImageFile(f))
    );

    const images = results
      .filter(r => r.success && r.image)
      .map(r => r.image!);

    if (images.length > 0) {
      this.onDrop(images);
    }

    return images;
  };

  isDragOver(): boolean {
    return this.dragOver;
  }
}

export async function handlePaste(e: ClipboardEvent): Promise<ImageAttachment[]> {
  const items = Array.from(e.clipboardData?.items || []);
  const imageItems = items.filter(item => item.type.startsWith('image/'));
  
  if (imageItems.length === 0) {
    return [];
  }

  const results = await Promise.all(
    imageItems.map(async (item) => {
      const file = item.getAsFile();
      if (!file) return { success: false, error: '无法获取文件' };
      return processImageFile(file);
    })
  );

  return results
    .filter(r => r.success && r.image)
    .map(r => r.image!);
}
