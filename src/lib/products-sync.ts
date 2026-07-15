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
        
        // If price changed, update and append to history
        if (unitPrice !== currentPrice) {
          const newHistoryEntry = { 
            price: unitPrice, 
            date: poDate, 
            timestamp: Date.now(),
            supplier: supplierName || "Unknown Supplier" 
          };
          await updateDoc(docRef, {
            currentPrice: unitPrice,
            lastUpdated: poDate,
            priceHistory: [...(data.priceHistory || []), newHistoryEntry]
          });
          console.log(`Updated price for ${barcode} from ${currentPrice} to ${unitPrice}`);
        } else {
          // Price unchanged, do nothing to avoid duplicate history
          console.log(`Price unchanged for ${barcode}, skipping write.`);
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
