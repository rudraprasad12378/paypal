import type { CatalogProduct } from "../types/index";
import fs from "fs";
import path from "path";

interface RawProduct {
  id: string;
  name: string;
  category: string;
  listPrice: number;
  minPrice: number;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  books: "📚",
  gadgets: "🎧",
  groceries: "🥑",
  fashion: "🎒",
  gaming: "🎮",
  peripherals: "🖱️",
  electronics: "⌨️",
  accessories: "🔌",
  "office & desk": "💡",
  prohibited: "🪙",
};

function getEmojiForCategory(category: string): string {
  return CATEGORY_EMOJIS[category.toLowerCase()] || "📦";
}

function loadProductsFromFile(): CatalogProduct[] {
  try {
    const filePath = path.join(process.cwd(), "data", "products.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const rawList = JSON.parse(content) as RawProduct[];
      return rawList.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        listPrice: p.listPrice,
        minReservePrice: p.minPrice,
        minPrice: p.minPrice,
        description: `${p.name} in category ${p.category}.`,
        sellerName: `${p.category.charAt(0).toUpperCase() + p.category.slice(1)} Direct`,
        sellerStyle: "fair",
        imageEmoji: getEmojiForCategory(p.category),
      }));
    }
  } catch (err) {
    console.warn("Could not read data/products.json, using fallback catalog:", err);
  }
  return [];
}

const fileProducts = loadProductsFromFile();

export const INITIAL_CATALOG: CatalogProduct[] = fileProducts.length > 0 ? fileProducts : [
  {
    id: "gadget-1",
    name: "Wireless Noise-Canceling Earbuds",
    category: "gadgets",
    listPrice: 49.99,
    minReservePrice: 34.99,
    minPrice: 34.99,
    description: "Wireless earbuds with active noise cancellation.",
    sellerName: "Gadgets Direct",
    sellerStyle: "fair",
    imageEmoji: "🎧",
  },
  {
    id: "gaming-1",
    name: "RGB Mechanical Gaming Keyboard",
    category: "gaming",
    listPrice: 44.0,
    minReservePrice: 30.8,
    minPrice: 30.8,
    description: "Mechanical switches with RGB lighting.",
    sellerName: "Gaming Direct",
    sellerStyle: "fair",
    imageEmoji: "🎮",
  },
];
