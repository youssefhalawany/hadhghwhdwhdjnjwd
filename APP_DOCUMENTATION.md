# ANH Reports - Comprehensive System Documentation

This document provides a detailed breakdown of the ANH Reports application, including its architecture, core portals, features, offline capabilities, and how the entire ecosystem connects.

---

## 1. System Overview & Architecture

**ANH Reports** is a modern, enterprise-grade Franchise Management System built for Circle K retail stores. It serves as the central nervous system for financial reporting, inventory auditing, shift management, and store operations.

### Technology Stack
- **Frontend Framework**: Next.js 15/16 (App Router)
- **Styling**: Tailwind CSS & Lucide React (Icons)
- **Database & Backend**: Firebase (Firestore)
- **Authentication**: Firebase Authentication
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Offline Engine**: PWA (`next-pwa`) + Firebase Persistent Local Cache

### The Dual-Portal Architecture
The application is a single codebase that dynamically behaves as **two entirely separate applications** depending on the user's entry point:
1. **The Cashier Portal**: A streamlined, task-focused interface for store employees.
2. **The Manager/Enterprise Portal**: A secure, data-rich dashboard for franchise owners and managers.

---

## 2. The Cashier Portal

The Cashier Portal is designed for speed, ease of use, and reliability on the store floor. It is primarily accessed via `/cashier` or direct PWA shortcuts.

### Key Characteristics
- **No Login Friction**: Designed to be instantly accessible on store devices without requiring complex enterprise logins, allowing cashiers to focus on their tasks.
- **Installable PWA**: Can be installed on the device as the "CK Cashier Portal" with an orange/dark theme and specialized shortcuts.
- **Offline-First**: Fully functional in areas with zero internet connectivity (e.g., inside walk-in freezers or during ISP outages).

### Core Features
- **Shift Reports (`/shift-reports/cashier`)**: Cashiers submit their end-of-shift financial data, including cash counted, drops made, and any expenses.
- **Voids & Returns (`/voids/cashier`)**: When a customer returns an item or a POS void occurs, the cashier submits a formal request with transaction details for manager approval.
- **Store Checklists (`/checklists/cashier`)**: Daily operational checklists (e.g., cleaning, stocking, temperature checks) that cashiers must complete during their shifts.
- **Expiries Management (`/expiries`)**: Cashiers log products that have expired or are nearing expiration, pulling them from the shelves and documenting them for audits.

---

## 3. The Manager Portal

The Manager Portal is a secure, analytical command center used by store managers and franchise owners to oversee operations across multiple branches. It is accessed via the root URL (`/`) and requires authentication.

### Key Characteristics
- **Enterprise Security**: Protected by Firebase Authentication.
- **Installable PWA**: Can be installed on manager devices as the "CK Manager Portal" with a premium red theme.
- **Multi-Branch & Multi-Lingual**: Managers can switch between branches (e.g., "El Alamein 4", "Ola El Koronfol") and instantly toggle the UI between English and Arabic.

### Core Features
- **Real-Time Auditing (The Dashboard)**:
  - **Shift Audits**: Managers review submitted shift reports, verifying cash drops against POS data.
  - **Voids & Returns Approval**: Managers review void requests. They can instantly **Approve** or **Reject** them.
  - **Supplier Returns**: Track items returning to suppliers for credit.
  - **Expiry Audits**: Review the expired products logged by cashiers to calculate shrinkage.
- **"Spotlight" Global Search (CMD+K)**: A rapid command-palette that allows managers to press CMD+K (or CTRL+K) anywhere in the app to instantly search for a specific cashier, transaction number (e.g., "TXN-9942"), or receipt.
- **Automated Audit Flags (Smart Highlighting)**: The system acts as a robotic assistant. If a cashier submits a void exceeding 150 EGP, the system automatically injects a flashing `⚠️ High Value` warning tag so the manager doesn't miss it.
- **Historical Context (Delta View)**: When reviewing a specific void, the system instantly calculates that cashier's average void amount over their last 5 voids. If the current void is suspiciously high compared to their historical average, the manager is alerted.
- **Live Notification Bell**: A real-time bell in the top navigation that shakes and shows a red badge the exact second a cashier submits a new report. It provides a dropdown to jump straight to the pending request.
- **Document Verification**: Uses SHA-256 Hash Validation to cryptographically verify reports.
- **Admin Tools (`/admin/*`)**: Features for importing products (CSV), managing cashier accounts, and smart scheduling.

---

## 4. How They Connect (The Data Flow)

The magic of ANH Reports lies in how seamlessly the Cashier and Manager portals communicate in real-time, even dealing with network instability.

### Step-by-Step Connection Flow:
1. **Data Entry (Cashier)**: A cashier at "El Alamein 4" fills out a Void Request on their portal.
2. **Offline Queueing (The Safety Net)**: If the store's Wi-Fi drops, the app doesn't crash. Firebase saves the void request locally to the device's hard drive using `persistentMultipleTabManager()`.
3. **Synchronization**: The moment the store's internet reconnects, the app silently pushes the queued void request to the Cloud (Firebase Firestore).
4. **Real-Time Broadcast (Cloud)**: Firebase receives the document and instantly broadcasts an update to all connected devices.
5. **Manager Reception**: 
   - The Manager, sitting at home on their iPad, has an active `onSnapshot` listener running in `ClientLayoutWrapper.tsx`.
   - The notification bell instantly ticks from `[0]` to `[1]` and plays a subtle sound.
   - The manager clicks the bell, sees the new void request from "El Alamein 4", and clicks it.
6. **Decision & Loop Closure**: The manager reviews the "Historical Context" and clicks "Approve". This updates the document status in Firestore to "approved". The cashier's terminal (if viewing history) instantly reflects this approved status.

---

## Summary of the Ecosystem
- **Cashiers** generate the raw data (operations, financials, inventory issues).
- **Firebase** acts as the indestructible bridge, holding data safely offline and syncing it instantly online.
- **Managers** consume, analyze, and approve the data using smart tools (CMD+K, Delta Views, Audit Flags) to make rapid, informed business decisions.
