const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/shift-reports/manager/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. activeTab
content = content.replace(
  'const [activeTab, setActiveTab] = useState<"pending" | "history" | "expiries">("pending");',
  'const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");'
);

// 2. States
content = content.replace('  const [expiries, setExpiries] = useState<any[]>([]);\n', '');
content = content.replace('  const [selectedExpiry, setSelectedExpiry] = useState<any | null>(null);\n', '');
content = content.replace('  const [isEditingExpiry, setIsEditingExpiry] = useState(false);\n  const [editExpiryDate, setEditExpiryDate] = useState("");\n  const [editExpiryQty, setEditExpiryQty] = useState("");\n', '');

// 3. fetch expiries
const fetchExpiriesRegex = /    \/\/ 3\. Fetch Expiries[\s\S]*?    \}\);\n/g;
content = content.replace(fetchExpiriesRegex, '');
content = content.replace('      unsubExpiries();\n', '');

// 4. functions
const handleMarkExpiryPulledRegex = /  const handleMarkExpiryPulled = async \(\)[\s\S]*?const handleDeleteExpiry/g;
// Wait, regex might be tricky if there's nested braces.
// Let's use simpler string replacements by finding the block.
