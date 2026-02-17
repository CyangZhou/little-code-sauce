import React, { useState, useRef, useCallback } from 'react';
import { X, Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import type { ImageAttachment } from '../services/imageSupport';
import { 
  processImageFile, 
  handlePaste, 
  ImageDropHandler 
} from '../services/imageSupport';

interface ImageAttachmentsProps {
  images: ImageAttachment[];
  onAdd: (images: ImageAttachment[]) => void;
  onRemove: (id: string) => void;
  maxImages?: number;
}

export const ImageAttachments: React.FC<ImageAttachmentsProps> = ({
  images,
  onAdd,
  onRemove,
  maxImages = 5,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;
    
    if (images.length + imageFiles.length > maxImages) {
      setError(`最多只能上传 ${maxImages} 张图片`);
      return;
    }

    const results = await Promise.all(
      imageFiles.map((f) => processImageFile(f))
    );

    const newImages = results
      .filter((r) => r.success && r.image)
      .map((r) => r.image!);

    if (newImages.length > 0) {
      onAdd(newImages);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteEvent = useCallback(async (e: ClipboardEvent) => {
    const newImages = await handlePaste(e);
    if (newImages.length > 0) {
      if (images.length + newImages.length > maxImages) {
        setError(`最多只能上传 ${maxImages} 张图片`);
        return;
      }
      onAdd(newImages);
    }
  }, [images.length, maxImages, onAdd]);

  React.useEffect(() => {
    const handler = new ImageDropHandler((imgs) => {
      if (images.length + imgs.length > maxImages) {
        setError(`最多只能上传 ${maxImages} 张图片`);
        return;
      }
      onAdd(imgs);
      setIsDragging(false);
    });

    const dropArea = dropRef.current;
    if (dropArea) {
      dropArea.addEventListener('dragover', (e) => {
        handler.handleDragOver(e);
        setIsDragging(true);
      });
      dropArea.addEventListener('dragleave', (e) => {
        handler.handleDragLeave(e);
        setIsDragging(false);
      });
      dropArea.addEventListener('drop', handler.handleDrop as unknown as EventListener);
    }

    document.addEventListener('paste', handlePasteEvent);

    return () => {
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [handlePasteEvent, images.length, maxImages, onAdd]);

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div ref={dropRef} className="image-attachments">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative group w-16 h-16 rounded-lg overflow-hidden border border-lcs-border"
            >
              <img
                src={image.thumbnail || image.dataUrl}
                alt={image.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => onRemove(image.id)}
                  className="p-1 bg-red-500/80 rounded-full hover:bg-red-500"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                <span className="text-[10px] text-white truncate block">
                  {image.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-lcs-muted hover:text-lcs-primary hover:bg-lcs-primary/10 rounded transition-colors"
        >
          <ImageIcon className="w-3 h-3" />
          添加图片
        </button>
        
        {images.length > 0 && (
          <span className="text-xs text-lcs-muted">
            {images.length}/{maxImages}
          </span>
        )}
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-lcs-primary/20 border-2 border-dashed border-lcs-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Upload className="w-8 h-8 text-lcs-primary mx-auto mb-2" />
            <span className="text-sm text-lcs-primary">释放以上传图片</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
};

interface ImagePreviewProps {
  image: ImageAttachment;
  onClick?: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ image }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div
        className="relative group cursor-pointer rounded-lg overflow-hidden border border-lcs-border"
        onClick={() => setIsFullscreen(true)}
      >
        <img
          src={image.dataUrl}
          alt={image.name}
          className="max-w-full max-h-64 object-contain"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
          <span className="text-xs text-white">{image.name}</span>
          {image.width && image.height && (
            <span className="text-xs text-white/60 ml-2">
              {image.width}×{image.height}
            </span>
          )}
        </div>
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={image.dataUrl}
            alt={image.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};
