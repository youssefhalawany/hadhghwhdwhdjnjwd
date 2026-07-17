import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import { productsDb } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, setDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    // Assuming the items folder is in the root of the project
    const filePath = path.join(process.cwd(), 'items', 'اكواد ادخال الفود (1).xlsx');
    
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    
    const headers: string[] = [];
    const data: any[] = [];
    
    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value?.toString().trim() || `Col${colNumber}`;
    });
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber]] = cell.value;
      });
      data.push(rowData);
    });

    const foodCodesCollection = collection(productsDb, 'food_codes');
    let count = 0;

    for (const item of data) {
      const itemId = item['Item ID']?.toString() || item['Item ID\r\n']?.toString();
      const factoryDesc = item['Factory Description'] || item['Factory Description\r\n'] || '';
      const systemDesc = item['System Description'] || item['System Description\r\n'] || '';
      const itemCode = item['Item'] || item['Item\r\n'] || '';

      if (!itemId || !systemDesc) continue;

      let categoryEn = 'General';
      let categoryAr = 'عام';

      const descLower = systemDesc.toString().toLowerCase();
      if (descLower.includes('sandwich')) {
        categoryEn = 'Sandwiches';
        categoryAr = 'ساندوتشات';
      } else if (descLower.includes('salad')) {
        categoryEn = 'Salads';
        categoryAr = 'سلطات';
      } else if (descLower.includes('coffee') || descLower.includes('espresso') || descLower.includes('kahwe')) {
        categoryEn = 'Coffee';
        categoryAr = 'قهوة';
      } else if (descLower.includes('croissant') || descLower.includes('bun') || descLower.includes('cake')) {
        categoryEn = 'Bakery';
        categoryAr = 'مخبوزات';
      } else if (descLower.includes('wrap')) {
        categoryEn = 'Wraps';
        categoryAr = 'راب';
      } else if (descLower.includes('pizza')) {
        categoryEn = 'Pizza';
        categoryAr = 'بيتزا';
      } else if (descLower.includes('raw material')) {
        categoryEn = 'Raw Materials';
        categoryAr = 'مواد خام';
      }

      const docData = {
        itemId: itemId.toString(),
        itemCode: itemCode.toString(),
        nameAr: factoryDesc.toString(),
        nameEn: systemDesc.toString(),
        categoryEn,
        categoryAr,
        createdAt: new Date().toISOString()
      };

      // Use the itemId as the document ID so it doesn't duplicate on multiple runs
      await setDoc(doc(foodCodesCollection, itemId.toString()), docData);
      count++;
    }

    return NextResponse.json({ success: true, count, sample: data.slice(0, 2) });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}
