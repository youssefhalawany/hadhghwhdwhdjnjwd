import { NextRequest, NextResponse } from "next/server";
import { productsDb } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

// High-resolution clean product studio photos mapped by product keywords
const BRAND_IMAGE_MAP: Record<string, string> = {
  // Water
  aquafina: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  water: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  
  // Soft Drinks & Soda
  pepsi: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500&auto=format&fit=crop&q=80",
  coca: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80",
  coke: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80",
  fanta: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",
  sprite: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=500&auto=format&fit=crop&q=80",
  soda: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",

  // Coffee & Espresso Drinks
  "mr brown": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80",
  brown: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80",
  espres: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80",
  coffee: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80",
  nescafe: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80",

  // Energy & Vitamin Drinks
  oronamin: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80",
  vitamin: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=500&auto=format&fit=crop&q=80",
  redbull: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&auto=format&fit=crop&q=80",
  energy: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&auto=format&fit=crop&q=80",

  // Chips & Crunchy Potato Snacks
  pringles: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",
  crunchos: "https://images.unsplash.com/photo-1621958046399-56e6d1945a8e?w=500&auto=format&fit=crop&q=80",
  stix: "https://images.unsplash.com/photo-1621958046399-56e6d1945a8e?w=500&auto=format&fit=crop&q=80",
  chipsy: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",
  chips: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",

  // Nuts & Premium Dry Fruits
  pistachio: "https://images.unsplash.com/photo-1536591375315-1b836815d2b0?w=500&auto=format&fit=crop&q=80",
  cashew: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80",
  nuts: "https://images.unsplash.com/photo-1536591375315-1b836815d2b0?w=500&auto=format&fit=crop&q=80",

  // Chocolate & Biscuits
  cadbury: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80",
  chocolate: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80",
  biscuit: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80",
  wafer: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80",

  // Dairy & Juices
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
  juhayna: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
  juice: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&auto=format&fit=crop&q=80"
};

// Studio product mockup placeholders by broad product category
const CATEGORY_FALLBACKS: Record<string, string> = {
  drink: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80",
  snack: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",
  food: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80",
  default: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80"
};

export async function POST(req: NextRequest) {
  try {
    const { barcode, name } = await req.json();

    if (!name && !barcode) {
      return NextResponse.json({ error: "Name or barcode required" }, { status: 400 });
    }

    const cleanName = (name || "").toLowerCase();
    let imageUrl = "";

    // 1. Check OpenFoodFacts API first if valid barcode exists
    if (barcode && barcode.length >= 8) {
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
        console.warn("OpenFoodFacts lookup failed:", err);
      }
    }

    // 2. Fallback to Keyword Studio Photo Map
    if (!imageUrl) {
      for (const [key, url] of Object.entries(BRAND_IMAGE_MAP)) {
        if (cleanName.includes(key)) {
          imageUrl = url;
          break;
        }
      }
    }

    // 3. Fallback to Wikimedia Commons Search API if still empty
    if (!imageUrl && name) {
      try {
        const wikiSearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(name + " product package")}&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
        const wikiRes = await fetch(wikiSearchUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          const pages = wikiData?.query?.pages;
          if (pages) {
            const firstPage = Object.values(pages)[0] as any;
            if (firstPage?.imageinfo?.[0]?.url) {
              imageUrl = firstPage.imageinfo[0].url;
            }
          }
        }
      } catch (err) {
        console.warn("Wikimedia lookup failed:", err);
      }
    }

    // 4. Default Clean Studio Product Mockup (No generic supermarket shelf photos!)
    if (!imageUrl) {
      if (cleanName.includes("drink") || cleanName.includes("water") || cleanName.includes("tea") || cleanName.includes("coffee") || cleanName.includes("shot")) {
        imageUrl = CATEGORY_FALLBACKS.drink;
      } else if (cleanName.includes("chip") || cleanName.includes("stix") || cleanName.includes("nut") || cleanName.includes("snack")) {
        imageUrl = CATEGORY_FALLBACKS.snack;
      } else {
        imageUrl = CATEGORY_FALLBACKS.default;
      }
    }

    // Update Firestore if barcode document exists
    if (barcode) {
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
