<h1 align="center">
  <br>
  <img src="./public/JoshiAO.jpg" alt="Sales Monitoring" width="120">
  <br>
  Interactive Sales Monitoring Platform
  <br>
</h1>

<h4 align="center">Transforming chaotic spreadsheet reporting into a real-time, high-performance web platform.</h4>

<p align="center">
  <a href="#key-features--business-impact">Key Features</a> •
  <a href="#technical-marvels--architecture">Architecture</a> •
  <a href="#ux--design-philosophy">UX & Design</a> •
  <a href="#technologies-used">Technologies Used</a>
</p>

<table>
  <tr>
    <td><img height="400" alt="Dashboard View" src="https://placehold.co/400x800/222222/00d4ff.png?text=Dashboard+Mobile+View" /></td>
    <td><img height="400" alt="Performance Panel" src="https://placehold.co/400x800/222222/00d4ff.png?text=Top+10+Gamification" /></td>
    <td><img height="400" alt="Analytics" src="https://placehold.co/400x800/222222/00d4ff.png?text=Data+Analytics+Charts" /></td>
  </tr>
</table>

An enterprise-grade, highly optimized **Progressive Web App (PWA)** engineered to track, aggregate, and gamify corporate sales performance across multiple organizational tiers.

This platform was built to solve a critical business problem: the painful, 30-day feedback loop caused by manual Excel reports. By centralizing data ingestion and applying real-time analytics, this platform enables instant coaching, automated leaderboards, and zero-trust data security.

[**View Live Platform Demo**](https://rd-sales-monitoring-demo.web.app/) | [**Connect on LinkedIn**](https://www.linkedin.com/in/joshua-ocampo-b67210384)

---

## Key Features & Business Impact

*   **Eliminated Spreadsheet Bottlenecks**: Replaces dozens of manual, error-prone Excel reports sent over email with a single unified, real-time platform.
*   **Accelerated Coaching Loops**: Supervisors can now identify underperforming regions and product lines instantly, drastically reducing the feedback loop from 30 days to 1 day.
*   **Automated Gamification**: Drives sales performance organically by automatically calculating STT (Net Value), UBA (Unique Buying Accounts), and VD30 metrics to rank salesmen and award weekly medals 🥇🥈🥉.
*   **Zero-Config Installation**: Fully installable as a PWA on iOS, Android, and Desktop (Chrome/Edge), providing a native app-like experience without app store approvals.

## Technical Marvels & Architecture

I architected this platform to handle massive enterprise data dumps without breaking a sweat or inflating cloud billing costs.

### 1. Hyper-Optimized Data Pipeline
*   **Intelligent Firestore Chunking:** Employs smart batching algorithms (450 operations per chunk) to effortlessly ingest tens of thousands of `Customer Master List` and `Net Invoiced` rows from `.xlsx` files directly in the browser.
*   **99% Read Reduction via IndexedDB:** Built an aggressive client-side caching layer using `idb-keyval`. The client verifies a single 1-byte global timestamp before fetching payload data, saving immense bandwidth and database reads.
*   **Scalable Subcollection Architecture:** Designed a historic snapshot system that compartmentalizes monthly data into nested subcollections (`snapshots/YYYY-MM/customers/{salesId}`), completely bypassing Firestore's rigid 1 MiB document size limit.

### 2. Zero-Trust Security & RBAC
*   **Strict Database Rules:** All Firestore collections are explicitly mapped and locked down. The `users` and `snapshots` databases are fully protected against unauthorized wildcard reads.
*   **Cloud Function Claim Syncing:** Utilized Firebase Cloud Functions v2 (`onDocumentWritten`) to instantly sync Firestore roles deep into Firebase Auth Custom Claims, cryptographically securing backend API routes.
*   **Dynamic UI Scoping:** Salesmen see only their own performance, Supervisors see their team's aggregates, and Managers see region-wide roll-ups.

## UX & Design Philosophy

*   **Mobile-First Adaptability**: The UI collapses gracefully from a multi-column desktop dashboard to an intuitive, thumb-friendly mobile layout for salesmen on the go.
*   **Cognitive Load Reduction**: Utilizes progressive disclosure—complex data like the "Value Drivers" and "Customers" panels use modals and collapsible accordions rather than overwhelming the user on the primary view.

## Technologies Used

### Frontend
- **React 19 (Vite, TypeScript)**: Lightning-fast UI rendering and bundling.
- **Custom CSS Architecture**: CSS Variables, Flex/Grid Layouts, Keyframe Animations.
- **Recharts**: Dynamic Line Graphs, Stacked Bars, Inner-Donut Pies.
- **Vite PWA Plugin**: Enterprise-grade progressive web app engine.
- **SheetJS (xlsx)**: Extreme-scale client-side Excel ingestion.

### Backend & Data Processing
- **Firebase**: BaaS providing Authentication, Firestore, and Storage.
- **Firebase Cloud Functions v2**: Node.js 20 serverless environment.

## Let's Connect

I specialize in building full-stack applications that solve real business problems with elegant, scalable code. If you are looking for an engineer who understands both deep technical architecture and high-level business impact, I would love to chat.

[**Contact Me via Email**](mailto:joshi.ao@outlook.ph) | [**View My Portfolio**](https://eikofisherman.web.app/)

## License

**All Rights Reserved.**

This repository and its source code are the proprietary property of the author. It is published publicly strictly for educational and portfolio review purposes. You may not copy, reproduce, distribute, compile, or utilize this software for any personal or commercial purposes without explicit written consent from the author. 

---
*Built as a showcase of modern full-stack development, distributed systems, and elegant UI/UX.*
