# 📊 Interactive Sales Monitoring Platform

A modern, highly premium, and responsive **Progressive Web App (PWA)** built for tracking and monitoring sales performance. This platform enables multiple roles—**Salesman, Supervisor, Manager, Admin, and Warehouse Supervisor**—to cascade goals, analyze targets, track inventory ageing/back-orders, and compete in a structured weekly gamification leaderboard.

---

## 🎯 Platform Access & Activation Flow

To ensure high security and enterprise containment, the application implements a strict two-stage entry process:

### 1. Device Activation
*   Before accessing the login interface, the device must be activated by submitting a valid **Company Code** on the Activation Page.
*   The system hashes the code using `SHA-256` and queries the Firestore database of a centralized project (`joshiao-active-projects`) via REST API to verify if it is valid and active.
*   Once validated, the code is stored in the browser's `localStorage` as proof of activation, which unlocks the main login route.

### 2. User Authentication & Session Guard
*   Authentication is managed through **Firebase Authentication** (Email & Password).
*   Routing guards automatically redirect unactivated sessions to `/activation`, unauthenticated sessions to `/login`, and unauthorized users away from premium tab views.
*   Custom claims (assigned dynamically or queried from user profile documents) define the user's role: `admin`, `manager`, `supervisor`, `salesman`, or `warehouse_supervisor`.

### 3. PWA Capabilities
*   Built with `vite-plugin-pwa`, the application is installable on both PC (Chrome/Edge desktop app) and Mobile (Add to Home Screen).
*   Includes automatic service worker updates and standalone offline asset caching using custom configurations.

---

## 👥 Role-Based Access Control (RBAC)

The sidebar navigation dynamically filters modules based on the logged-in user's role:

| Navigation Tab | Salesman | Supervisor | Manager | Admin | Warehouse Supervisor |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Home** (Overview) | Yes | Yes | Yes | Yes | No |
| **Sales** (Metrics & Geo) | Yes | Yes | Yes | Yes | No |
| **VD30** (Placements) | Yes | Yes | Yes | Yes | No |
| **Customers** (Details) | Yes | Yes | Yes | Yes | No |
| **NPD & Promo** (Launch KPIs) | Yes | Yes | Yes | Yes | No |
| **Ageing** (Inventory Expiry) | No | Yes | Yes | Yes | Yes |
| **B.O.** (Back Orders) | Yes | Yes | Yes | Yes | Yes |
| **Gamification** (Leaderboard) | Yes | Yes | Yes | Yes | Yes |
| **Data Upload** (Admin Panel) | No | No | No | Yes | No |
| **Users** (CRUD Management) | No | No | No | Yes | No |

### Access & Aggregate Scopes:
*   **Salesman**: Restricted strictly to self performance metrics and customer cards.
*   **Supervisor**: Aggregates and displays team-wide salesman performance. Can review and propose weekly commitments.
*   **Manager**: Aggregates all salesman metrics grouped by supervisor, views supervisor targets, and approves/rejects target proposals. Has a team slicer to filter views.
*   **Admin**: Inherits manager scopes, possesses full CRUD control over users, and parses/uploads Excel data packages.
*   **Warehouse Supervisor**: Specialized operations role restricted to managing Ageing reports, viewing Back Orders (B.O.), and monitoring the Gamification Leaderboard.

---

## 📈 Metric Definitions & Business Rules

The analytical engine processes Firestore documents based on strict criteria:

### 1. Customer Master List (CML)
*   **Base Universe**: Counts active/approved customer entries assigned to the salesman's ID.
*   **Database Condition**: `STATUS == "Active/Approved"`.

### 2. Unique Buying Accounts (UBA) & Strike Rate
*   **Calculation**: Counts the number of unique `Sold To Customer number` keys inside the `Net Invoiced` dataset having a `Net Value >= ₱1.00` during the current month.
*   **Strike Rate %**: Calculated as `(UBA / Active CML) * 100`.

### 3. Value Drivers 30 (VD30)
*   **Definition**: Measures store penetration/placements (distribution) rather than absolute invoice values.
*   **Condition**: Sales are counted only if the `Channel` classification contains the substring `"Sari-Sari"` (to eliminate groceries/supermarkets from inflating distribution counts).
*   **Item Hit Rule**: A salesman receives credit (a hit) for a VD30 category only when their actual unique store placements meet or exceed their assigned target store placements for that individual item.
*   **Service Model Scope**:
    *   **Ex-Truck**: Monitored strictly on the first **19 items** (Items 1-19).
    *   **Booking**: Monitored on all **30 items** (Items 1-30).

---

## 🏆 Weekly Commitments & Gamification

The platform gamifies performance metrics (`STT`, `UBA`, and `VD30`) on a weekly lifecycle. 

### 1. Cumulative Target Proposal
Supervisors propose targets that must be **cumulative (added up over the month)** rather than isolated weekly goals:
*   *Week 1*: Propose target index (e.g., **20%**)
*   *Week 2*: Propose target index (e.g., **45%** - 20% from W1 + 25% for W2)
*   *Week 3*: Propose target index (e.g., **70%** - 45% from W2 + 25% for W3)
*   *Week 4*: Propose target index (e.g., **100%** - 70% from W3 + 30% for W4)

Proposals must be approved by a Manager or Admin via the **Commitment Settings** card before they affect calculations.

### 2. Leaderboard Eligibility Rules
*   **STT (Net Value)**: Coupled to target commitments. A salesman is filtered out of the leaderboard for the week if:
    1. The supervisor has not proposed a target, or it is not yet approved.
    2. The salesman's actual STT achievement percentage is below the approved commitment target.
*   **UBA & VD30**: Decoupled from the strict commitment approval gate to prevent empty leaderboards. Salesmen are ranked directly based on achievement index relative to their base monthly targets (`actual / target`).

### 3. Medals & Points Distribution
At the end of each week, the system evaluates all eligible candidates separated by Service Model (`Ex-Truck` vs `Booking`):
*   🥇 **Gold Medal (Rank 1)**: +5 points, awarded card highlights.
*   🥈 **Silver Medal (Rank 2)**: +3 points, awarded card highlights.
*   🥉 **Bronze Medal (Rank 3)**: +1 point, awarded card highlights.
*   🎗️ **Rank 4-10**: +0 points.

Accumulated points throughout the month determine final monthly ranks. High-ranking salesmen are highlighted with corresponding Gold/Silver/Bronze card borders in the performance panels.

---

## 📂 Admin Data Upload Schema

Admins upload structured `.xlsx` files which are parsed on the client side using `xlsx` (SheetJS) and saved in Firestore. Below are the required columns for each template:

### 1. Net Invoiced
Tracks raw transaction rows.
```text
RD Name | Date | Week | Branch Name | Employee Code | Employee Name | Channel | Sold To Customer number | Sold To Customer Name | Category | Product Code | Product Description | Volume | Net Value | Good Stock Returns | Bad Stock Returns | Channel_Classification | Brgy | Town | Province | FS | RTM Model | GT Channel
```

### 2. Customer Master List (CML)
The database of active clients.
```text
BRANCH NAME | CDAM | FS | CHANNEL | SALES REP ID | SALES REP NAME | CUSTOMER CODE | CUSTOMER NAME | BARANGAY | CITY | PROVINCE | STATUS | RETAIL ENVIRONMENT | PARTY CLASSIFICATION DESCRIPTION | COVERAGE DAY | WKLY COVERAGE | FREQ COUNT | FREQ
```

### 3. VD30 Target
Numeric store-count targets per salesman.
```text
salesman_code | F01_2403 | F02_64480 | ... | F30_62727
```

### 4. Salesman Target STT and UBA
```text
salesman_code | stt_target | uba target
```

### 5. Category Reference
```text
category
```

### 6. Channel Reference
Maps classifications to key account buckets.
```text
party_classification_description | key_account
```

### 7. Geo Hierarchy Data
```text
Province | City | Barangay
```

### 8. VD30 Items Reference
Maps product codes to target value driver codes.
```text
product_code | product_description | vd30_code | vd30_description
```

---

## ⚙️ Technical Stack

**Frontend**
*   **Framework**: React 19 (Vite, TypeScript)
*   **Styling**: Custom CSS (CSS Variables, Flexbox/Grid, Animations)
*   **State Management**: React Context (`AuthContext`)
*   **Data Visualization**: Recharts (Line, Stacked Bar, Inner-Donut Pie)
*   **Icons**: Lucide React
*   **PWA Engine**: Vite PWA Plugin

**Backend & Data Processing**
*   **BaaS**: Firebase (Auth, Firestore, Storage)
*   **Serverless**: Firebase Cloud Functions v2 (Node.js 20)
*   **Data Parsing**: SheetJS (`xlsx`) for client-side Excel ingestion
*   **Image Processing**: React Easy Crop for profile avatars

---

## 🔒 Security Architecture

The application implements a strict two-stage entry process to prevent unauthorized corporate access:
1.  **Device Activation**: Devices must submit a valid **Company Code**. The code is hashed (`SHA-256`) and verified via a REST API against a centralized `joshiao-active-projects` database before the login screen is even rendered.
2.  **Firebase Authentication**: Standard Email/Password login.
3.  **Strict Firestore Rules**: All collections are explicitly mapped and locked down. The `users` and `snapshots` collections are fully protected against unauthorized wildcard reads.

---

## 🛠️ Local Development & Setup

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/JoshiAO/sales-monitoring-dashboard.git
cd sales-monitoring-dashboard
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root containing your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Running Locally
Launch the Vite development server with hot-reloading:
```bash
npm run dev
```

### 4. Deploying to Firebase
Compile the production build and deploy to Firebase Hosting & Functions:
```bash
# Build the React frontend
npm run build

# Build and deploy Firebase Cloud Functions
cd functions && npm install && npm run build && cd ..

# Deploy everything
firebase deploy
```

---

*Copyright © 2026 Joshua Alforque Ocampo. All Rights Reserved.*
