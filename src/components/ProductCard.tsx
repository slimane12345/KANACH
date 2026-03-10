import React, { useState, useEffect } from 'react';
import { Trash2, Package } from 'lucide-react';
import { Product, db } from '../db';
import { motion } from 'motion/react';

interface ProductCardProps {
  product: Product;
  onDelete: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onDelete }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (product.imageData) {
      const url = URL.createObjectURL(product.imageData);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [product.imageData]);

  const handleDelete = async () => {
    if (product.id) {
      await db.products.delete(product.id);
      onDelete();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md"
    >
      <div className="aspect-square w-full bg-zinc-100">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={product.name} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Package size={48} />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="truncate text-lg font-bold text-zinc-900">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xl font-black text-emerald-600">
            ${product.price.toFixed(2)}
          </span>
          <button
            onClick={handleDelete}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
