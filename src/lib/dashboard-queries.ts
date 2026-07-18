import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date: Date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export async function fetchDashboardData(branchId: string) {
  const todayStr = getLocalDateString(new Date());
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  let salesQuery = query(collection(db, 'sales'), where('date', '==', todayStr));
  let voidsQuery = query(collection(db, 'void_requests'), where('date', '==', todayStr));
  let expiriesQuery = query(collection(db, 'expiries'), where('expiryDate', '==', tomorrowStr));
  let needsAttentionQuery = query(collection(db, 'shift_reports'), orderBy('createdAt', 'desc'), limit(20));

  if (branchId !== 'all') {
    const storeIdMap: Record<string, string> = {
      "alamein4": "eL-alamein-4",
      "ola": "ola-el-koronfol"
    };
    const dbStoreId = storeIdMap[branchId] || branchId;

    salesQuery = query(collection(db, 'sales'), where('date', '==', todayStr), where('storeId', 'in', [branchId, dbStoreId]));
    // void_requests only has branchId
    voidsQuery = query(collection(db, 'void_requests'), where('date', '==', todayStr), where('branchId', 'in', [branchId, dbStoreId]));
    expiriesQuery = query(collection(db, 'expiries'), where('expiryDate', '==', tomorrowStr), where('storeId', 'in', [branchId, dbStoreId]));
    needsAttentionQuery = query(collection(db, 'shift_reports'), where('branchId', 'in', [branchId, dbStoreId]), orderBy('createdAt', 'desc'), limit(20));
  }

  const collectedUrls = new Set<string>();

  const safeGet = async (q: any, queryName: string) => {
    try {
      return await getDocs(q);
    } catch (err: any) {
      if (err.message?.includes("https://console.firebase.google.com")) {
        const urlMatch = err.message.match(/(https:\/\/console\.firebase\.google\.com[^\s]*)/);
        if (urlMatch) collectedUrls.add(urlMatch[0]);
      } else {
        console.error(`${queryName} Error:`, err);
      }
      return { docs: [] };
    }
  };

  const [salesSnap, voidsSnap, expiriesSnap, attentionSnap] = await Promise.all([
    safeGet(salesQuery, "Sales"),
    safeGet(voidsQuery, "Voids"),
    safeGet(expiriesQuery, "Expiries"),
    safeGet(needsAttentionQuery, "Needs Attention")
  ]);

  let totalSales = 0;
  let totalShortage = 0;
  
  salesSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    totalSales += Number(data.cash || 0) + Number(data.visa || 0);
    totalShortage += Number(data.overShort || 0);
  });

  let totalVoids = 0;
  let pendingVoids = 0;
  voidsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    totalVoids += Number(data.amount || 0);
    if (!data.approved) pendingVoids++;
  });

  const expiringTomorrow = expiriesSnap.docs.length;

  // Process Needs Attention
  const needsAttention: any[] = [];
  attentionSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (Number(data.cashShortage || 0) < -100) {
      needsAttention.push({
        id: doc.id,
        type: 'shortage',
        message: `High Cash Shortage (${data.cashShortage} EGP) in ${data.cashierName}'s shift`,
        link: '/shift-reports/manager'
      });
    }
  });

  if (pendingVoids > 0) {
    needsAttention.push({
      id: 'voids',
      type: 'void',
      message: `${pendingVoids} Voids waiting for approval`,
      link: '/voids/manager'
    });
  }

  // Fetch 7-Day Revenue Trend from sales collection
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);

  let weekQuery = query(collection(db, 'sales'), where('date', '>=', sevenDaysAgoStr));
  if (branchId !== 'all') {
    const storeIdMap: Record<string, string> = {
      "alamein4": "eL-alamein-4",
      "ola": "ola-el-koronfol"
    };
    const dbStoreId = storeIdMap[branchId] || branchId;
    weekQuery = query(collection(db, 'sales'), where('date', '>=', sevenDaysAgoStr), where('storeId', 'in', [branchId, dbStoreId]));
  }
  
  const weekSnap = await safeGet(weekQuery, "7-Day Trend");
  
  const chartDataMap: Record<string, any> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    chartDataMap[dateStr] = { 
      name: dateStr.substring(5), // MM-DD
      fullDate: dateStr,
      alamein4: 0, 
      ola: 0,
      total: 0 // single line if branch is selected
    };
  }

  weekSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (chartDataMap[data.date]) {
      const bKey = (data.branchId || data.storeId || '').toLowerCase().includes('ola') ? 'ola' : 'alamein4';
      const saleAmount = Number(data.cash || 0) + Number(data.visa || 0);
      chartDataMap[data.date][bKey] += saleAmount;
      chartDataMap[data.date].total += saleAmount;
    }
  });

  const chartData = Object.values(chartDataMap);

  return {
    kpis: {
      totalSales,
      totalShortage,
      totalVoids,
      expiringTomorrow
    },
    chartData,
    needsAttention,
    missingIndexes: Array.from(collectedUrls)
  };
}
