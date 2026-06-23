const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const https = require('https');
const serviceAccount = require('/Users/youssefhalawanyy/Downloads/ckkk-576e7-firebase-adminsdk-fbsvc-3610b035eb.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

let messageQueue = [];

function queueWhatsAppNotification(text) {
  messageQueue.push(text);
}

setInterval(() => {
  if (messageQueue.length === 0) return;
  
  const textToSend = messageQueue.join('\n\n---\n\n');
  messageQueue = []; // Clear queue
  
  const phone = encodeURIComponent('+201011212003');
  const apikey = '3367979';
  const waText = encodeURIComponent(textToSend);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${waText}&apikey=${apikey}`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('WhatsApp batch notification sent:', data));
  }).on('error', (err) => {
    console.error('Error sending WhatsApp batch notification:', err.message);
  });
}, 60000); // 60 seconds

// These collections are not triggering the Next.js API, so we listen to them directly
const listeners = [
  {
    collection: 'sales',
    formatMessage: (data) => `*New Sales Record*\nCashier: ${data.cashierName || 'Unknown'}\nShift: ${data.shift || 'Unknown'}\nMoney: Cash ${data.cash || 0}, Visa ${data.visa || 0}\nOver/Short: ${data.overShort || 0}\nCreated By: ${data.createdBy || 'Unknown'}`
  },
  {
    collection: 'cash_payments',
    formatMessage: (data) => `*New Cash Payment*\nAmount: ${data.amount || 0}\nCategory: ${data.category || 'N/A'}\nTo/Company: ${data.companyName || 'N/A'}\nCreated By: ${data.createdBy || 'Unknown'}\nNotes: ${data.description || data.categoryNote || 'N/A'}`
  },
  {
    collection: 'credit_payments',
    formatMessage: (data) => `*New Credit Payment*\nAmount: ${data.amount || 0}\nCreated By: ${data.createdBy || 'Unknown'}\nStore: ${data.storeId || 'N/A'}\nDate: ${data.date || 'N/A'}`
  },
  {
    collection: 'credits',
    formatMessage: (data) => `*New Credit Added*\nAmount Due: ${data.amountDue || 0}\nCompany: ${data.companyName || 'Unknown'}\nCreated By: ${data.createdBy || 'Unknown'}\nInvoice: ${data.invoiceNumber || 'N/A'}`
  },
  {
    collection: 'expiries',
    formatMessage: (data) => `*New Expiry Tracked*\nItem: ${data.itemName || 'Unknown'}\nQuantity: ${data.quantity || 0}\nExpires: ${data.expiryDate || 'N/A'}\nAdded By: ${data.addedBy || 'Unknown'}`
  },
  {
    collection: 'void_requests',
    formatMessage: (data) => `*New Void/Return*\nAmount: ${data.amount || 0}\nCashier: ${data.cashierName || 'Unknown'}\nReason: ${data.reason || 'N/A'}\nTransaction: ${data.transactionNumber || 'N/A'}`
  }
];

console.log('Starting WhatsApp Firebase Listener for all collections...');

listeners.forEach(({ collection, formatMessage }) => {
  let isInitial = true;
  
  db.collection(collection).onSnapshot(snapshot => {
    if (isInitial) {
      isInitial = false;
      return; // Skip initial payload
    }
    
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const msg = formatMessage(data);
        console.log(`Detected new document in ${collection}`);
        queueWhatsAppNotification(msg);
      }
    });
  }, err => {
    console.error(`Error listening to ${collection}:`, err);
  });
});
