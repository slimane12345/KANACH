import React, { useEffect, useState } from 'react';
import { db, Product } from '../db';
import { ProductCard } from './ProductCard';
import { Search, LayoutGrid } from 'lucide-react';

interface ProductGridProps {
  refreshTrigger: number;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ refreshTrigger }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const allProducts = await db.products.orderBy('createdAt').reverse().toArray();
      setProducts(allProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [refreshTrigger]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="text-emerald-600" size={24} />
          <h2 className="text-xl font-bold text-zinc-900">Product Inventory</h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
            {products.length}
          </span>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 py-2 pl-10 pr-4 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onDelete={fetchProducts} 
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-100 py-20 text-center">
          <div className="mb-4 rounded-full bg-zinc-50 p-4">
            <Search size={32} className="text-zinc-300" />
          </div>
          <p className="text-zinc-500">No products found.</p>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="mt-2 text-sm font-medium text-emerald-600 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};
