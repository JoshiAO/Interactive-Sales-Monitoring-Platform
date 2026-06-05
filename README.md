# 📊 Sales Monitoring Dashboard

A modern, robust, and highly responsive **Sales Monitoring Web Application** tailored for fast-paced sales operations. This platform enables multiple roles (Admin, Manager, Supervisor, and Salesman) to track targets, daily sales, unique buying accounts, frequency metrics, and customer analytics in a sleek, beautifully designed interface.

## 🚀 Key Features

*   **🔐 Role-Based Access Control (RBAC):** Distinct interfaces, dashboards, and permissions for `Admin`, `Manager`, `Supervisor`, and `Salesman`.
*   **📈 Real-Time Data Visualization:** Interactive charts, responsive grids, and clean visual cards representing Net Invoiced Value, Volume, GSR/BSR, and Frequency metrics using Recharts.
*   **👥 Team Filtering & Slicing:** Intuitive "Team Slicers" allowing managers and admins to filter metrics on-the-fly by specific teams.
*   **📂 Excel Data Upload:** Built-in tool for Admins to easily upload, process, and map massive raw Excel data directly into the Firebase database.
*   **📱 Fully Responsive UI:** Optimized for both Desktop and Mobile experiences with smooth micro-animations, glassmorphism design, and mobile-friendly sidebars.
*   **🔥 Firebase Integration:** Secure authentication, real-time Firestore database queries, and Firebase Storage for user avatars.
*   **🏆 Performance Ranking Panel:** An integrated real-time leaderboard highlighting the top-performing salesmen.

## 💻 Tech Stack

*   **Frontend Framework:** React 19 (Vite)
*   **Language:** TypeScript
*   **Styling:** Custom CSS with Glassmorphism, CSS Variables, and Flex/Grid Layouts
*   **Charting:** Recharts
*   **Icons:** Lucide React
*   **Backend & Database:** Firebase Auth, Firestore, and Cloud Storage
*   **Data Processing:** XLSX (SheetJS)
*   **Image Processing:** React Easy Crop

## 🛠️ Project Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/sales-monitoring-dashboard.git
   cd sales-monitoring-dashboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the root directory and add your Firebase project credentials:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📂 Project Structure

```text
src/
├── components/
│   ├── auth/          # Login and Activation forms
│   ├── common/        # Reusable UI components (Cards, Modals)
│   └── layout/        # Sidebar, Header, and Performance Panel
├── contexts/          # React Context (Auth state management)
├── firebase/          # Firebase configuration and initialization
├── hooks/             # Custom React Hooks for Firestore data fetching
├── pages/
│   ├── admin/         # Data Upload and User Management pages
│   ├── dashboard/     # Sales, VD30, Customers, and Home pages
│   └── error/         # 404 and fallback views
├── index.css          # Global styling, tokens, and utility classes
└── App.tsx            # Main application router and role guards
```

## ✨ Design Philosophy

The application utilizes a rich, dynamic aesthetic focusing on a premium **dark mode** experience:
*   Harmonious **deep blue** gradients and **glassmorphism** panels.
*   Smooth micro-interactions (hover states, transitions).
*   Clean typography utilizing native sans-serif font stacks.
*   Information hierarchy structured for quick, at-a-glance scanning of critical sales data.

## 👨‍💻 Author

**Joshua Alforque Ocampo**
* Principal Developer & Architect

## 📄 License

This project is licensed under the [MIT License](LICENSE). 
Copyright (c) 2026 Joshua Alforque Ocampo. All Rights Reserved.
