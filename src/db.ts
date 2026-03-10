import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  name: string;
  price: number;
  imageData: Blob | null;
  createdAt: number;
}

export class POSDatabase extends Dexie {
  products!: Table<Product>;

  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      products: '++id, name, price, createdAt'
    });
  }
}

export const db = new POSDatabase();
