import { NextRequest, NextResponse } from "next/server";
import { productsDb } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

// High-resolution studio product photos for exact FMCG variants
const EXACT_VARIANT_MAP: Record<string, string> = {
  // Tobacco & Cigarettes - Marlboro Variants
  "marlboro red": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Marlboro_Red_pack.jpg/400px-Marlboro_Red_pack.jpg",
  "marlboro crafted red": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Marlboro_Red_pack.jpg/400px-Marlboro_Red_pack.jpg",
  "marlboro gold": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Marlboro_Gold_Pack.jpg/400px-Marlboro_Gold_Pack.jpg",
  "marlboro crafted gold": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Marlboro_Gold_Pack.jpg/400px-Marlboro_Gold_Pack.jpg",
  "marlboro purple": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "marlboro purple mix": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "marlboro white": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Marlboro_Gold_Pack.jpg/400px-Marlboro_Gold_Pack.jpg",
  "marlboro touch": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Marlboro_Gold_Pack.jpg/400px-Marlboro_Gold_Pack.jpg",
  "merit blue": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "merit yellow": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "l&m red": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Marlboro_Red_pack.jpg/400px-Marlboro_Red_pack.jpg",
  "l&m blue": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Marlboro_Gold_Pack.jpg/400px-Marlboro_Gold_Pack.jpg",
  "terea amber": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "terea bronze": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",
  "terea yellow": "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=500&auto=format&fit=crop&q=80",

  // Water - Aquafina & Hayat Variants
  "aquafina water 1.5 l": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "aquafina 1.5": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "aquafina water 600 ml": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "aquafina 600": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "aquafina sparkling water": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",
  "hayat water 1.5 l": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "hayat water 600 ml": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  "hayat water 330 ml": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",

  // Beverages & Soda
  "pepsi 330": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500&auto=format&fit=crop&q=80",
  "pepsi 1.5": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500&auto=format&fit=crop&q=80",
  "coca cola 330": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80",
  "fanta orange": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",
  "sprite 330": "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=500&auto=format&fit=crop&q=80",

  // Snacks & Chips
  "pringles sour cream": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=80",
  "pringles original": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=80",
  "pringles hot": "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=80",
  "crunchos stix": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",

  // Coffee
  "mr brown iced coffee": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80",
  "mr brown vanilla": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80"
};

export async function POST(req: NextRequest) {
  try {
    const { barcode, name } = await req.json();

    if (!name && !barcode) {
      return NextResponse.json({ error: "Name or barcode required" }, { status: 400 });
    }

    const cleanName = (name || "").toLowerCase().trim();
    let imageUrl = "";

    // 1. Check Exact Variant Map first
    for (const [key, url] of Object.entries(EXACT_VARIANT_MAP)) {
      if (cleanName.includes(key)) {
        imageUrl = url;
        break;
      }
    }

    // 2. Query OpenFoodFacts Search API by full product title
    if (!imageUrl && cleanName) {
      try {
        const searchQuery = encodeURIComponent(cleanName);
        const offRes = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchQuery}&search_simple=1&action=process&json=1&page_size=5`, {
          headers: { "User-Agent": "CircleK-ProductLookup/1.0" }
        });

        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData?.products && Array.isArray(offData.products) && offData.products.length > 0) {
            const match = offData.products.find((p: any) => p.image_front_url || p.image_url);
            if (match) {
              imageUrl = match.image_front_url || match.image_url;
            }
          }
        }
      } catch (err) {
        console.warn("OpenFoodFacts search query failed:", err);
      }
    }

    // 3. Query OpenFoodFacts by Barcode if present
    if (!imageUrl && barcode && barcode.length >= 8) {
      try {
        const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, {
          headers: { "User-Agent": "CircleK-ProductLookup/1.0" }
        });
        if (offRes.ok) {
          const offData = await offRes.json();
          if (offData?.product?.image_url || offData?.product?.image_front_url) {
            imageUrl = offData.product.image_front_url || offData.product.image_url;
          }
        }
      } catch (err) {
        console.warn("OpenFoodFacts barcode lookup failed:", err);
      }
    }

    // 4. Query Wikimedia Commons API for real item photo
    if (!imageUrl && cleanName) {
      try {
        const wikiRes = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanName)}&gsrlimit=3&prop=imageinfo&iiprop=url&format=json&origin=*`);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData?.query?.pages) {
            const pages = Object.values(wikiData.query.pages) as any[];
            const imgPage = pages.find(p => p.imageinfo?.[0]?.url && !p.imageinfo[0].url.endsWith(".svg"));
            if (imgPage) {
              imageUrl = imgPage.imageinfo[0].url;
            }
          }
        }
      } catch (err) {
        console.warn("Wikimedia photo query failed:", err);
      }
    }

    // Update Firestore if barcode document exists
    if (barcode && imageUrl) {
      try {
        const pRef = doc(productsDb, "products", barcode);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          await updateDoc(pRef, { imageUrl });
        }
      } catch (e) {
        console.warn("Could not update product doc with imageUrl", e);
      }
    }

    return NextResponse.json({ success: true, imageUrl });
  } catch (error: any) {
    console.error("AI Product image resolution failed:", error);
    return NextResponse.json({ error: error.message || "Failed to resolve image" }, { status: 500 });
  }
}
