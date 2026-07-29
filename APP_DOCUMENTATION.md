# ANH Reports - Comprehensive Enterprise System Documentation

## 1. System Overview & Architecture

**ANH Reports** is an enterprise-grade Franchise Management & Retail Operations System engineered specifically for Circle K store operations. It operates as the central command center for real-time financial reporting, inventory auditing, shift management, HR/payroll, AI forecasting, and store workflow automation.

### Core Technology Stack
- **Frontend Framework**: Next.js 15/16 (App Router) with TypeScript
- **Styling**: Tailwind CSS & Lucide React (Icon System)
- **Database & Realtime Engine**: Google Firebase (Cloud Firestore with Offline Cache Persistence)
- **Authentication & Security**: Firebase Auth & Custom Claims Role-Based Access Control (RBAC)
- **Push Notifications**: Firebase Cloud Messaging (FCM) & Web Push
- **Offline PWA Engine**: `next-pwa` with `persistentMultipleTabManager` Local Storage Sync
- **AI Infrastructure**: Integrated LLM Chat Assistant, Vision OCR Receipt Extractor, TTS Audio Engine & Predictive Inventory Forecasting

---

## 2. Dual-Portal Architecture & Access Levels

The application provides specialized user experiences based on user roles and entry points:

1. **Cashier Portal (`/cashier/*`)**: Fast, touchscreen-optimized, friction-free portal for front-line store employees. Supports offline PWA mode for stockrooms and walk-in coolers.
2. **Manager Portal (`/` & `/admin/*` & `/financial-reports/*`)**: Comprehensive analytical command center for store managers, inventory control officers, and shift supervisors.
3. **Owner / Executive Hub (`/owner/*`)**: High-level financial reporting dashboard for franchise owners and corporate executives overseeing multi-branch performance, bank deposits, and credit statements.

---

## 3. Comprehensive Page Directory

Below is the exhaustive directory of all application pages organized by domain:

### 3.1 Store Operations & Cashier Portal (`/cashier/*`)
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/cashier` | Cashier Home Hub | Cashier | Quick action cards, quick-actions FAB, real-time store alerts, language toggle. |
| `/cashier/lookup` | Barcode & Price Lookup | Cashier | Rapid SKU search, barcode scanning, price check, stock level verification. |
| `/cashier/food-codes` | PLU & Hot Food Guide | Cashier | Visual catalog of Circle K hot food, bakery, and fountain beverage PLU codes. |
| `/cashier/offers` | Store Offers & Bundles | Cashier | Active store promotions, multi-buy bundle reference, cashier sales scripts. |
| `/cashier/schedule` | Shift Schedule & Leaves | Cashier | Personal shift calendar, shift swap requests, leave balance check. |
| `/cashier/sop` | Store SOP & Manuals | Cashier | Standard Operating Procedures, emergency guidelines, employee handbook. |
| `/cashier/lost-and-found` | Lost & Found Directory | Cashier | View registered customer lost items and resolution status. |
| `/cashier/lost-and-found/add` | Log Lost Item | Cashier | Register customer lost items with photo upload, location, and description. |
| `/cashier/out-of-stock` | Report Stockout | Cashier | Instant shelf stockout logging to alert inventory managers. |
| `/cashier/upload-invoice/[id]`| Invoice Scanner | Cashier | Scan/upload vendor invoices or delivery receipts via camera. |
| `/cashier/cleaning` | Cleaning Checklist | Cashier | Daily hygiene & sanitization task execution with completion toggles. |
| `/cashier/master` | Master Cashier Portal | Cashier | Centralized shortcuts to all cashier operations. |
| `/cashier/account` | Cashier Profile | Cashier | Active shift status, store location switcher, account settings. |

### 3.2 Shift Reports & Voids Management
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/shift-reports/cashier` | Cashier Shift Report | Cashier | End-of-shift cash declaration, card payments, safe drops, vouchers, expenses. |
| `/shift-reports/cashier/success`| Shift Report Receipt | Cashier | SHA-256 cryptographic proof generation and submission receipt. |
| `/shift-reports/manager` | Manager Shift Audit | Manager | Real-time cash drop reconciliation, POS variance calculation, report approval. |
| `/shift-reports/view` | Shift Report Archive | Manager/Owner | Searchable historical shift report archive with filter by date/branch. |
| `/voids/cashier` | Request POS Void/Return | Cashier | Formal request entry for POS item returns or voids with receipt details. |
| `/voids/cashier/success` | Void Request Receipt | Cashier | Confirmation receipt for pending void/return approval request. |
| `/voids/manager` | Manager Void Approval | Manager | Review pending voids, view historical cashier void averages (Delta View), approve/reject. |

### 3.3 Checklists & Quality Control
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/checklists/cashier` | Active Store Checklists | Cashier | Operational checklists list (opening, closing, temperature, cleaning). |
| `/checklists/cashier/[id]` | Interactive Checklist | Cashier | Fill out checklist tasks with photo proof and status confirmation. |
| `/checklists/manager` | Checklist Audit Hub | Manager | Monitor completed checklists across branches, audit timestamps, flag issues. |
| `/checklists/manager/print/[id]`| Printable Checklist PDF| Manager | Generate formatted PDF audit sheets for physical compliance filings. |
| `/admin/cleaning` | Cleaning Master Admin | Manager | Define cleaning schedules, assign store zones, audit hygiene execution. |

### 3.4 Inventory Management & Audits
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/expiries` | Expiry Log Tool | Cashier/Auditor | Log near-expiry products with barcode scanner and shelf removal tracking. |
| `/products/expiries-audit` | Expiry Audit Center | Manager | Review expired product logs, waste value calculations, supplier credit claims. |
| `/inventory-audit/cashier` | Physical Stock Count | Cashier | Enter physical shelf counts during routine store inventory audits. |
| `/inventory-audit/manager` | Inventory Audit Audit | Manager | Reconcile physical inventory counts against system counts, calculate variances. |
| `/dashboard/supplier-returns` | Supplier Return Audit | Manager | Track items returning to vendors for replacement or financial credit notes. |
| `/products/supplier-orders` | Supplier Purchase Orders| Manager | Generate, translate, and dispatch supplier purchase orders. |
| `/dashboard/margin-calculator`| Retail Margin Calculator| Manager | Calculate cost price, retail price, VAT, and gross profit margins. |
| `/admin/adjustments` | Stock Adjustment Log | Manager | Authorize inventory write-offs, shrinkage adjustments, and internal consumption. |
| `/admin/inventory-predict` | AI Stock Forecasting | Manager | Predictive analytics for inventory reordering points based on historical sales. |

### 3.5 Financial Reports & Executive Owner Hub
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/financial-reports` | Financial Overview | Manager/Owner | Centralized financial reporting hub with revenue and profit metrics. |
| `/financial-reports/pnl` | Profit & Loss (P&L) | Owner/Executive | Store-level and franchise-wide P&L statements with expense breakdown. |
| `/financial-reports/month-summary`| Monthly Financial Summary| Owner/Executive | Aggregated monthly shift reports, cash drops, and card reconciliation. |
| `/financial-reports/end-shift-cash`| Cash Variance Report | Owner/Executive | Comprehensive audit of end-of-shift safe drops vs POS cash declarations. |
| `/financial-reports/expenses` | Store Expense Audit | Manager/Owner | Log and classify operational expenses, petty cash vouchers, and store maintenance. |
| `/financial-reports/sales-and-credits`| Sales & Credits | Owner/Executive | Track total gross sales, customer credit accounts, and store credit notes. |
| `/financial-reports/vendor-statements`| Vendor Payment Ledger | Owner/Executive | Track balances owed to suppliers, invoice histories, and payment vouchers. |
| `/financials/detailed-sales` | AI Detailed Sales Breakdown| Manager/Owner | Automated breakdown of product-level sales extracted from POS reports. |
| `/financials/inputs` | Financial Data Entry Suite| Financial Admin | Unified hub for logging sales, credits, deposits, cheques, and payments. |
| `/financials/inputs/sales` | Sales Data Input | Financial Admin | Manual input/upload of daily store sales figures. |
| `/financials/inputs/credits` | Credits Input | Financial Admin | Record vendor/customer credit entries. |
| `/financials/inputs/deposits` | Bank Deposit Input | Financial Admin | Upload bank deposit slips and safe transfer details. |
| `/financials/inputs/cheques` | Cheques Input | Financial Admin | Track post-dated and cleared vendor cheques. |
| `/financials/inputs/payments` | Vendor Payment Input | Financial Admin | Record supplier invoice payment vouchers. |
| `/financials/inputs/safe-report` | Safe Balance Log | Financial Admin | Register physical cash counts in main store safe. |
| `/financials/inputs/tmt-invoices` | TMT Invoices Log | Financial Admin | Track internal transfer and TMT corporate invoice entries. |
| `/financials/products-price` | Master Price Index | Financial Admin | Maintain master purchase costs and retail selling price list. |
| `/financials/report-search` | Deep Report Search | Financial Admin | Global search across all financial inputs, invoices, and vouchers. |
| `/financials/out-of-stock` | Stockout Revenue Loss | Owner/Executive | Financial impact analysis of lost sales due to stockouts. |
| `/owner` | Owner Command Hub | Owner | Executive dashboard overview of multi-store revenue, cash drops, and alerts. |
| `/owner/sales` | Executive Sales View | Owner | Multi-branch high-level sales trends and target comparisons. |
| `/owner/credits` | Executive Credits View | Owner | Multi-branch credit portfolio overview. |
| `/owner/deposits` | Executive Deposit Audit | Owner | Verified bank deposit slip audits vs safe drops. |
| `/owner/payments` | Executive Payment Audit | Owner | Vendor payment authorization and tracking. |

### 3.6 HR, Payroll & User Administration
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/hr/employees` | HR Employee Master | HR/Manager | Employee profiles, contract details, attendance records, document storage. |
| `/admin/payroll` | Payroll Management | HR/Manager | Automated monthly salary calculation, deductions, overtime, bonus payouts. |
| `/admin/schedule` | Smart Shift Scheduler | Manager | Drag-and-drop shift schedule planner with automated coverage validation. |
| `/admin/users` | User & Role Management | Admin | Create cashier accounts, set store access permissions, reset PINs/passwords. |
| `/settings/cashiers` | Cashier Account Settings | Admin | Store-level PIN configuration, cashier status toggles, shift permissions. |
| `/settings/notifications` | Push Notification Rules | Admin | Configure automated threshold alerts, bell notifications, and push targets. |
| `/settings/audit-log` | System Audit Trail | Admin | View immutable system audit logs of all user actions and system changes. |
| `/audit-logs` | Global System Logs | Admin | Deep inspection of security and administrative log events. |

### 3.7 Tools, Utilities & AI Infrastructure
| URL Route | Page Title | Target User | Key Capabilities & Features |
| :--- | :--- | :--- | :--- |
| `/ai-assistant` | Retail AI Assistant | All Users | Conversational AI assistant supporting store queries, voice TTS, and actions. |
| `/label-designer` | Thermal Label Designer | Store Admin | Visual editor for custom shelf price tags, barcodes, and promotional labels. |
| `/print-server` | ESC/POS Print Server | Store Admin | Thermal printer connection configuration, receipt layout settings, audio cues. |
| `/report-builder` | Custom Report Generator| Manager/Owner | Drag-and-drop report builder to generate bespoke operational & financial tables. |
| `/handshake` | Shift Handshake Verification| Cashier/Manager | Inter-shift handover verification, cash drawer transfer, inventory sign-off. |
| `/verify/[token]` | SHA-256 Report Verifier | Any Auditor | Public cryptographic report verification page via QR code or token link. |
| `/verify/check` | Manual Hash Inspector | Any Auditor | Input hash token manually to verify document authenticity against Firestore. |

---

## 4. Key Functional Subsystems & Workflows

### 4.1 Real-Time Shift & Financial Auditing
1. **Cashier Shift Submission**: Cashiers log cash, card transactions, vouchers, safe drops, and expenses.
2. **Automated Audit Flags**: If a void or expense exceeds preset thresholds (e.g. >150 EGP), flashing system alerts (`⚠️ High Value`) are injected.
3. **Delta View Historical Analysis**: When evaluating a shift report or void request, the system displays the cashier's 5-shift historical average to highlight statistical anomalies.
4. **Manager Approval & Multi-Tab Notification**: Firebase `onSnapshot` updates connected manager devices instantly with sound alerts and shaking bell indicators.

### 4.2 Automated Document Verification & Security
* **SHA-256 Cryptographic Hashing**: Every finalized shift report, void request, and financial input generates a unique SHA-256 cryptographic hash token.
* **Public QR Code Verification**: Reports print with QR codes linking to `/verify/[token]`, enabling auditors to verify that physical printouts match the digital ledger exactly.

### 4.3 AI & Machine Learning Services
* **OCR Receipt & Invoice Extractor (`/api/extract-receipt`, `/api/upload-invoice`)**: Automatically parses photo uploads of receipts and invoices to extract items, totals, VAT, and vendor details.
* **Conversational AI Assistant (`/ai-assistant`, `/api/chat-assistant`)**: Natural language assistant capable of answering store operational questions, querying shift reports, and translating supplier orders.
* **Voice TTS Engine (`/api/tts`)**: Converts operational alerts and AI responses into spoken Arabic/English voice notifications.
* **Predictive Reordering (`/admin/inventory-predict`)**: Analyzes historic inventory velocity to auto-generate recommended stock purchase quantities.

### 4.4 Multi-Branch & Multi-Lingual Architecture
* **Seamless Branch Switcher**: Header control allows managers to toggle views instantly between locations (e.g. "El Alamein 4", "Ola El Koronfol").
* **Dynamic I18n Engine**: Instant language switching between English and Arabic (`dictionaries/en.json`, `dictionaries/ar.json`) across all UI elements, tables, and receipts.

---

## 5. API Route Architecture (`/api/*`)

| API Endpoint | HTTP Method | Description |
| :--- | :--- | :--- |
| `/api/chat-assistant` | `POST` | Processes natural language user prompts and returns AI guidance. |
| `/api/tts` | `POST` | Generates text-to-speech audio files for voice notifications. |
| `/api/extract-receipt` | `POST` | OCR engine to parse physical receipts and void vouchers. |
| `/api/extract-detailed-sales` | `POST` | Extracts line-item sales metrics from uploaded POS summary sheets. |
| `/api/upload-invoice` | `POST` | Processes vendor invoices and syncs items into Firestore. |
| `/api/analyze-sales` | `POST` | AI sales pattern analysis and anomaly detector. |
| `/api/process-po` | `POST` | Validates and formats purchase orders for supplier dispatch. |
| `/api/translate-order` | `POST` | Translates purchase order line items between English and Arabic. |
| `/api/schedule/generate` | `POST` | Automated shift scheduling algorithm considering employee rules. |
| `/api/schedule/leave-requests` | `GET/POST` | Manages employee leave applications and calendar sync. |
| `/api/checklists` | `GET/POST` | REST API for fetching and submitting store operational checklists. |
| `/api/notifications/send` | `POST` | Dispatches FCM push notifications to targeted user roles. |
| `/api/notifications/notify-owners`| `POST` | High-priority push notifications dispatched to franchise owners. |
| `/api/cron/daily-report` | `GET` | Scheduled background job compiling daily financial summaries. |

---

## 6. Offline-First PWA Synchronization

1. **Persistent Local Cache**: Uses Firebase Firestore's `persistentMultipleTabManager()` to write all data to IndexedDB when offline.
2. **Offline Data Queue**: Submissions made while in walk-in freezers or during network outages queue safely on the device.
3. **Silent Background Re-Sync**: Re-establishes connection automatically upon network restoration and syncs queued mutations without user intervention.
