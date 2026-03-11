import Dexie, { type Table } from 'dexie';

export interface Category {
  id?: number;
  name: string;
}

export interface Product {
  id?: number;
  barcode?: string;
  categoryId?: number;
  name: string | null;
  price: number | null;
  image?: string;
  imageData?: Blob;
  createdAt: number;
}

export class BulkScanDatabase extends Dexie {
  categories!: Table<Category>;
  products!: Table<Product>;

  constructor() {
    super('BulkScanDB');
    this.version(1).stores({
      categories: '++id, name',
      products: '++id, barcode, categoryId, createdAt'
    });
  }
}

export const db = new BulkScanDatabase();

// Initial data helper
export async function seedDatabase() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd([
      { name: 'Milk Products' },
      { name: 'Drinks' },
      { name: 'Snacks' },
      { name: 'Oils' },
      { name: 'Grains' },
      { name: 'Personal Care' }
    ]);
  }
}
