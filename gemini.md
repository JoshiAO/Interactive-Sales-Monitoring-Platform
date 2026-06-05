# 🏗️ Gemini 3.1 Pro Prompt  
**Project:** Sales Monitoring Website with Role-Based Access  
**Backend:** Firebase (Auth, Firestore, Storage)  
**Frontend:** Responsive Web (Desktop + Mobile)  

---

## 🔑 Activation & Login
- **Activation Page:** Requires `Company Code` before login.
- **Login Page:** Firebase Authentication.
- **Role-Based Landing Pages:**
  - Admin
  - Manager
  - Supervisor
  - Salesman

---

## 👥 User Access Scope
- **Salesman:** Access only self performance.
- **Supervisor:** Access all salesman performance of their team.
- **Manager:** Access all salesman performance grouped by supervisor + supervisor performance.
- **Admin:** Full access + User Management + Data Upload (xlsx → Firebase).

---

## 📊 Data & Analytics
- Translate **Net Invoiced data** into:
  - Graphs (bar, line, pie)
  - Performance dashboards
  - Category, channel, geo breakdowns
- Performance Panel:
  - Top 10 salesman (profile pic, name, value)
  - Tabs: STT, UBA, VD30, NPD, Promo Packs
  - Responsive:  
    - Web → right panel  
    - Mobile → hidden, accessible via floating analytics button → fullscreen modal

---

## 📂 Tabs per Role
- **Salesman / Supervisor / Manager:**  
  Home, Sales, VD30, Customers, NPD, Promo Packs, Ageing, B.O.
- **Admin:**  
  Home, Sales, VD30, Customers, NPD, Promo Packs, Ageing, B.O., Data, Users

---

## 🏠 Home Page
- **Salesman:**  
  - Cards: Target, Month-to-Date Sales, Balance, UBA  
    - Web: 4×1 row  
    - Mobile: 2×2 grid  
  - VD30 bar chart  
  - Product category pie chart  
  - NPD performance (STT + UBA values)  
  - Performance Panel (Top 10 salesman)  
- **Supervisor:** Same layout, team values.  
- **Manager:** Same layout, slicer for all/teams.  
- **Admin:** Same as Manager.

---

## 📈 Sales Page
- **Salesman:**  
  - Month-to-date performance: Target, STT (Net Value), STT Balance, Volume, GSR, BSR  
  - Current CML count  
  - UBA Target, Performance, Balance  
  - Frequency (F1–F4)  
  - Product category, customer channel, geo performance (barangay)  
- **Supervisor:** Same layout, team values, geo by city.  
- **Manager:** Same layout, slicer for all/teams.  
- **Admin:** Same as Manager.

---

## 📊 VD30 Page
- **Salesman:**  
  - Line graph for VD30 performance  
  - Itemized cards (4 rows) with meters (target vs actual, % index)  
  - Modal on card click → product breakdown  
  - Ex-Truck → 1–19 items only  
  - Booking → all 30 items  
- **Supervisor:** Same layout, team values.  
- **Manager:** Same layout, slicer for all/teams.  
- **Admin:** Same as Manager.

---

## 👤 Customers Page
- **Salesman:**  
  - Customer cards: Code, Name, Barangay, City, Volume, Net Value, GSR, BSR, Tagging (Buying/Non-Buying)  
  - Filters: Search, Tagging, Barangay, City  
- **Supervisor:** Same layout, team values.  
- **Manager:** Same layout, slicer for all/teams.  
- **Admin:** Same as Manager.

---

## 🚧 Under Development
- NPD, Promo Packs, Ageing, B.O. → Grayed out until ready.

---

## 📂 Data Page (Admin Only)
- Upload settings for:  
  - Net Invoiced  
  - CML (Customer Master List)  
  - STT & UBA Target  
  - VD30 Target  
  - Item Category Reference  
  - Channel Reference  
  - VD30 Items Reference  
  - Geo Hierarchy Reference  

---

## 👥 Users Page (Admin Only)
- User cards grouped by role.  
- Fields: Name, Email, Profile Picture, Salesman ID, Team, Salesman Type (Ex-Truck/Booking), Company Code.  
- Profile Picture upload by Admin only.  
- CRUD operations: Create, Edit, Delete users.  

---

## 📝 Notes
- Home page greets user by name.  
- Performance panel: Top 3 normal size, 4–10 progressively smaller.  
- Firebase handles Auth, Firestore for data, Storage for images.  

---

## 🎯 Development Milestones
1. Activation + Login + Role-based routing  
2. Salesman dashboard (Home + Sales + VD30 + Customers)  
3. Supervisor dashboard (team aggregation)  
4. Manager dashboard (team slicer)  
5. Admin dashboard (Data + Users management)  
6. Analytics integration (charts, performance panel)  
7. Responsive design (desktop + mobile)  
