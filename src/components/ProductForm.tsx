import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Package, DollarSign, Save } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { db } from '../db';
import { CameraModal } from './CameraModal';

interface ProductFormProps {
  onSuccess: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImage(file);
    }
  };

  const processImage = async (file: Blob) => {
    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file as File, options);
      setImage(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));
    } catch (error) {
      console.error("Compression error:", error);
      // Fallback to original if compression fails
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    setIsSubmitting(true);
    try {
      await db.products.add({
        name,
        price: parseFloat(price),
        imageData: image,
        createdAt: Date.now(),
      });
      
      // Reset form
      setName('');
      setPrice('');
      setImage(null);
      setPreviewUrl(null);
      onSuccess();
    } catch (error) {
      console.error("Error adding product:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeImage = () => {
    setImage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-xl font-bold text-zinc-900">Add New Product</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Product Name</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Organic Coffee"
                className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Price</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-zinc-200 py-2.5 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">Product Image</label>
            
            {previewUrl ? (
              <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-8 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50"
                >
                  <Upload className="text-zinc-400" size={24} />
                  <span className="text-xs font-medium text-zinc-600">Upload Image</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-8 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50"
                >
                  <Camera className="text-zinc-400" size={24} />
                  <span className="text-xs font-medium text-zinc-600">Take Photo</span>
                </button>
              </div>
            )}
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? 'Saving...' : 'Save Product'}
        </button>
      </form>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={processImage}
      />
    </div>
  );
};
