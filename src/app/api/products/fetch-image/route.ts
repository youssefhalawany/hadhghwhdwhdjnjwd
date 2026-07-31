import { NextRequest, NextResponse } from "next/server";
import { productsDb } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

// Curated high-res fallback product image mapping for common retail items
const BRAND_IMAGE_MAP: Record<string, string> = {
  aquafina: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  water: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80",
  pepsi: "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500&auto=format&fit=crop&q=80",
  coca: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80",
  coke: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=500&auto=format&fit=crop&q=80",
  chipsy: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",
  chips: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=80",
  cadbury: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80",
  chocolate: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500&auto=format&fit=crop&q=80",
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
  juhayna: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
  redbull: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&auto=format&fit=crop&q=80",
  energy: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=500&auto=format&fit=crop&q=80",
  coffee: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80",
  nescafe: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&auto=format&fit=crop&q=80"
};

export async function POST(req: NextRequest) {
  try {
    const { barcode, name } = await req.json();

    if (!name && !barcode) {
      return NextResponse.json({ error: "Name or barcode required" }, { status: 400 });
    }

    const cleanName = (name || "").toLowerCase();
    let imageUrl = "";

    // 1. Check OpenFoodFacts API first if barcode exists
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

    // 2. Fallback to Brand Keywords or Wikipedia Commons image search
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
        const wikiSearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(name)}&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
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

    // 4. Default clean fallback retail placeholder image
    if (!imageUrl) {
      imageUrl = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80";
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
