# 📊 Interactive Sales Monitoring Platform

> **Transforming chaotic spreadsheet reporting into a real-time, high-performance web platform.**

An enterprise-grade, highly optimized **Progressive Web App (PWA)** engineered to track, aggregate, and gamify corporate sales performance across multiple organizational tiers. 

This platform was built to solve a critical business problem: the painful, 30-day feedback loop caused by manual Excel reports. By centralizing data ingestion and applying real-time analytics, this platform enables instant coaching, automated leaderboards, and zero-trust data security.

[**View Live Platform Demo**](#) | [**Connect on LinkedIn**](#)

---

## 💼 Business Impact & ROI

*   **Eliminated Spreadsheet Bottlenecks**: Replaces dozens of manual, error-prone Excel reports sent over email with a single unified, real-time platform.
*   **Accelerated Coaching Loops**: Supervisors can now identify underperforming regions and product lines instantly, drastically reducing the feedback loop from 30 days to 1 day.
*   **Automated Gamification**: Drives sales performance organically by automatically calculating STT (Net Value), UBA (Unique Buying Accounts), and VD30 metrics to rank salesmen and award weekly medals 🥇🥈🥉.

---

## ⚡ Technical Marvels & Architecture

I architected this platform to handle massive enterprise data dumps without breaking a sweat or inflating cloud billing costs.

### 1. Hyper-Optimized Data Pipeline
*   **Intelligent Firestore Chunking:** Employs smart batching algorithms (450 operations per chunk) to effortlessly ingest tens of thousands of `Customer Master List` and `Net Invoiced` rows from `.xlsx` files directly in the browser.
*   **99% Read Reduction via IndexedDB:** Built an aggressive client-side caching layer using `idb-keyval`. The client verifies a single 1-byte global timestamp before fetching payload data, saving immense bandwidth and database reads.
*   **Scalable Subcollection Architecture:** Designed a historic snapshot system that compartmentalizes monthly data into nested subcollections (`snapshots/YYYY-MM/customers/{salesId}`), completely bypassing Firestore's rigid 1 MiB document size limit.

### 2. Zero-Trust Security & RBAC
*   **Strict Database Rules:** All Firestore collections are explicitly mapped and locked down. The `users` and `snapshots` databases are fully protected against unauthorized wildcard reads.
*   **Cloud Function Claim Syncing:** Utilized Firebase Cloud Functions v2 (`onDocumentWritten`) to instantly sync Firestore roles deep into Firebase Auth Custom Claims, cryptographically securing backend API routes.
*   **Dynamic UI Scoping:** Salesmen see only their own performance, Supervisors see their team's aggregates, and Managers see region-wide roll-ups.

### 3. Progressive Web App (PWA) Capabilities
*   **Installable Anywhere:** Fully installable on iOS, Android, and Desktop (Chrome/Edge), providing a native app-like experience without app store approvals.
*   **Custom Design System:** Built from the ground up with Vanilla CSS featuring modern glassmorphism tokens, micro-animations, and a highly responsive Flex/Grid architecture.

---

## 🎨 UX & Design Philosophy

*   **Mobile-First Adaptability**: The UI collapses gracefully from a multi-column desktop dashboard to an intuitive, thumb-friendly mobile layout for salesmen on the go.
*   **Cognitive Load Reduction**: Utilizes progressive disclosure—complex data like the "Value Drivers" and "Customers" panels use modals and collapsible accordions rather than overwhelming the user on the primary view.

---

## ⚙️ Core Technology Stack

*   **Frontend**: React 19 (Vite, TypeScript)
*   **Styling**: Custom CSS Architecture (CSS Variables, Flex/Grid Layouts, Keyframe Animations)
*   **Database & Auth**: Firebase (Auth, Firestore, Storage)
*   **Serverless Environment**: Firebase Cloud Functions v2 (Node.js 20)
*   **Data Parsing**: SheetJS (`xlsx`) for extreme-scale client-side Excel ingestion
*   **Data Visualization**: Recharts (Dynamic Line Graphs, Stacked Bars, Inner-Donut Pies)
*   **PWA Engine**: Vite PWA Plugin

---

## 🤝 Let's Connect

I specialize in building full-stack applications that solve real business problems with elegant, scalable code. If you are looking for an engineer who understands both deep technical architecture and high-level business impact, I would love to chat.

[**Contact Me via Email**](mailto:joshi.ao@outlook.ph) | [**View My Portfolio**](https://eikofisherman.web.app/)

---

*Copyright © 2026 Joshua Alforque Ocampo. All Rights Reserved.*
