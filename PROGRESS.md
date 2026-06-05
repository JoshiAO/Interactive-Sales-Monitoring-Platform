# Project Progress - Sales Monitoring Website

## 🎯 Recent Updates & Bug Fixes
- **Performance Panel Overhaul**: Redesigned the Performance Panel to match the modern aesthetic of the VD30 modals. Added profile pictures and medals for top rankings.
- **VD30 Integration**: Successfully integrated the VD30 metrics into the Performance Panel as an isolated tab (since the logic differs from STT and UBA).
- **Item-by-Item VD30 Logic**: Rewrote the VD30 engine to evaluate strictly on a per-item basis. A salesman only earns a point (hit) for a VD30 item if their Actual Store Placements `>=` Target Store Placements.
- **Sari-Sari Store Filtering (Crucial Fix)**: Discovered that VD30 is exclusively intended for Sari-Sari stores. Updated the `Net Invoiced` upload engine to **ignore** all placements in Groceries, Supermarkets, etc., for VD30 metrics. It now strictly counts placements where the Channel contains "Sari-Sari". This fixed the issue where actual counts were heavily inflated (which previously caused scores like 28/30).
- **Deployment**: Successfully built the production bundle and deployed the latest version live to Firebase Hosting (`https://rd-sales-monitoring.web.app`).

## 📝 Pending / Next Steps
- Re-upload the `Net Invoiced` data on the live admin dashboard so the new "Sari-Sari strictly" filtering applies to the current data.
- Ensure that the Excel document uploaded under `VD30 Target` contains the raw target number of Sari-Sari stores, NOT the percentage weightings. 

## 🏗️ Under Development (For Future Sessions)
- NPD, Promo Packs, Ageing, and B.O. tabs are currently grayed out and awaiting development.
- Further polish and analytics optimizations as requested.
