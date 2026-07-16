import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { productsDb } from "./firebase";

export async function syncProductsToMaster(items: any[], poDate: string, supplierName?: string) {
  if (!items || items.length === 0) return;

  for (const item of items) {
    let barcode = item.barcode?.toString().trim();
    
    if (!barcode) {
      if (item.description) {
        // Fallback to a sanitized version of the description as the ID
        barcode = item.description.toString().trim().replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 50);
      }
    }
    
    if (!barcode) continue;

    const unitPrice = Number(item.unitPrice) || 0;
    const docRef = doc(productsDb, "products", barcode);
    
    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentPrice = data.currentPrice || 0;
        
        const newHistoryEntry = { 
          price: unitPrice, 
          date: poDate, 
          timestamp: Date.now(),
          supplier: supplierName || "Unknown Supplier" 
        };

        // Check if we already have this exact entry to prevent duplicates from rapid saves
        const isDuplicate = data.priceHistory?.some(
           (h: any) => h.date === poDate && h.supplier === (supplierName || "Unknown Supplier") && h.price === unitPrice
        );

        if (!isDuplicate) {
          await updateDoc(docRef, {
            currentPrice: unitPrice, // Update current price (will be same if it hasn't changed)
            lastUpdated: poDate,
            priceHistory: [...(data.priceHistory || []), newHistoryEntry]
          });
          console.log(`Added history entry for ${barcode} at price ${unitPrice}`);
        } else {
          console.log(`Skipping duplicate history entry for ${barcode}`);
        }
      } else {
        // Create new product
        const newHistoryEntry = { 
          price: unitPrice, 
          date: poDate, 
          timestamp: Date.now(),
          supplier: supplierName || "Unknown Supplier" 
        };
        await setDoc(docRef, {
          barcode,
          description: item.description || "",
          currentPrice: unitPrice,
          lastUpdated: poDate,
          priceHistory: [newHistoryEntry]
        });
        console.log(`Created new product ${barcode} with price ${unitPrice}`);
      }
    } catch (err) {
      console.error(`Failed to sync product ${barcode}:`, err);
    }
  }
}
