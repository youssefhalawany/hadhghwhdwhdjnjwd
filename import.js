const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('/Users/youssefhalawanyy/Downloads/ckkk-576e7-firebase-adminsdk-fbsvc-3610b035eb.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

const rawData = `
30/05/2026
0
11,695
9,598
0


11,695
31/05/2026
11,695
9,550
9,700
465
اكياس و جلافز

20,780
1/06/2026
20,780
11,325
7,315
7,750
Filter Maintanance

24,355
2/06/2026
24,355
7,360
3,781
5,000
Transportation (warehouse)

26,715
3/06/2026
26,715
6,750
8,781
0


33,465
4/06/2026
33,465
11.855
6,566
3,123
Puvana water
2551691
42,197
5/06/2026
42,197
9,670
11,333
0


51,867
6/06/2026
51,867
8,500
8,037
31,650
Salaries,
Redull, spuds
2551738
2551739
28,717
7/06/2026
28,717
7,595
6,189
450
Filter Maintanance

35,862
8/06/2026
35,862
6,805
6,477
0


42,667
9/06/2026
42,667
6,661
7,511
0


49,328
10/06/2026
49,328
10,345
13,684
0


59,673
11/06/2026
59,673
17,772
14,668
3,540
Mansour water
2551710
73,905
12/06/2026
73,905
13,838
13,245
167
منظفات

87,576
13/06/2026
87,576
12,660
11,824
0


100,236
14/06/2026
100,236
11,339
9,669
665
Kemet order
2551752
110,910
15/06/2026
110,910
10,790
2,456
0


121,700
16/06/2026
121,700
12,220
9,873
9,294
Corona 
2551702
124,626
17/06/2026
124,626
14,705
5,963
11,709
Rashedeen / Transportation
2551767
127,622
18/6/2026
127,622
13,580
10,946
33,630
Mr.ashraf

108,572
19/6/2026
108,572
19,299
15,552
2,786
Order(Tea R )
foodtrip
2551771
2551769
125,085
20/6/2026
125,085
14,041
14,740
0


139,126
21/6/2026
139,126
14,431
8,603



153,557
22/6/2026
153,557
12,607
8,076
21,735
Mansour 
Redbull
خامات برجر Coca Cola
2551751
2551776
2551777
144,429
23/06/2026
144,429


120,000
Mr.Ashraf
`;

function parseDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  let d = parts[0];
  let m = parts[1];
  let y = parts[2];
  if (d.length === 1) d = '0' + d;
  if (m.length === 1) m = '0' + m;
  return `${y}-${m}-${d}`;
}

function parseNum(str) {
  if (!str) return 0;
  return Number(str.replace(/,/g, '').replace(/\./g, ''));
}

async function run() {
  const lines = rawData.split('\n');
  let currentRecord = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      if (currentRecord.length > 0) {
        await processRecord(currentRecord);
        currentRecord = [];
      }
    }
    if (currentRecord.length === 0 && line === '') continue;
    currentRecord.push(line);
  }
  if (currentRecord.length > 0) {
    await processRecord(currentRecord);
  }
  console.log("Done");
  process.exit(0);
}

async function processRecord(recordLines) {
  try {
    const dateStr = recordLines[0];
    const date = parseDate(dateStr);
    const startCash = parseNum(recordLines[1]);
    const cash = parseNum(recordLines[2]);
    const visa = parseNum(recordLines[3]);
    const deduction = parseNum(recordLines[4]);
    
    while(recordLines[recordLines.length-1] === '') {
      recordLines.pop();
    }
    
    const endCash = parseNum(recordLines[recordLines.length - 1]);
    
    let middleStuff = recordLines.slice(5, recordLines.length - 1).filter(l => l !== '');
    let details = middleStuff.join(' | ');
    let poNumbers = "";
    
    if (middleStuff.length > 0 && middleStuff[middleStuff.length-1].match(/^\d+$/)) {
       poNumbers = middleStuff[middleStuff.length-1];
       middleStuff.pop();
       details = middleStuff.join(' | ');
    }
    
    if (!date) return;

    await db.collection("end_shift_cash").doc(date).set({
      date,
      startCash,
      cash,
      visa,
      deduction,
      details,
      poNumbers,
      endCash,
      createdAt: new Date().toISOString()
    });
    console.log("Added record for", dateStr);
  } catch(e) {
    console.error("Error processing record", recordLines[0], e);
  }
}

run();
