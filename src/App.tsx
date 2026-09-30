import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';
import { PageGuard } from './components/layout/PageGuard';
import Activation from './pages/Activation';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Home from './pages/dashboard/Home';
import Sales from './pages/dashboard/Sales';
import VD30 from './pages/dashboard/VD30';
import Customers from './pages/dashboard/Customers';
import PerformancePage from './pages/dashboard/PerformancePage';
import NpdPromoPacks from './pages/dashboard/NpdPromoPacks';
import Ageing from './pages/dashboard/Ageing';
import BackOrder from './pages/dashboard/BackOrder';
import DataManagement from './pages/admin/DataManagement';
import Users from './pages/admin/Users';
import IncentivesPage from './pages/dashboard/IncentivesPage';
import IncentiveDetails from './pages/dashboard/IncentiveDetails';
import ArchivedIncentives from './pages/dashboard/ArchivedIncentives';
import MasterCoveragePlan from './pages/dashboard/MasterCoveragePlan';

import ManningPage from './pages/logistics/ManningPage';
import DeliverySchedulePage from './pages/logistics/DeliverySchedulePage';
import DeliveriesPage from './pages/logistics/DeliveriesPage';
import PicklistPage from './pages/logistics/PicklistPage';
import DDRMSPage from './pages/logistics/DDRMSPage';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  
  const companyCode = localStorage.getItem('companyCode');
  if (!companyCode) return <Navigate to="/activation" replace />;
  if (loading) return <div className="flex-center min-h-screen">Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/activation" element={<Activation />} />
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<PageGuard pageId="home"><Home /></PageGuard>} />
        <Route path="sales" element={<PageGuard pageId="sales"><Sales /></PageGuard>} />
        <Route path="vd30" element={<PageGuard pageId="vd30"><VD30 /></PageGuard>} />
        <Route path="customers" element={<PageGuard pageId="customers"><Customers /></PageGuard>} />
        <Route path="npd" element={<PageGuard pageId="npd"><NpdPromoPacks /></PageGuard>} />
        <Route path="ageing" element={<PageGuard pageId="ageing"><Ageing /></PageGuard>} />
        <Route path="bo" element={<PageGuard pageId="bo"><BackOrder /></PageGuard>} />
        <Route path="data" element={<PageGuard pageId="data_management"><DataManagement /></PageGuard>} />
        <Route path="users" element={<PageGuard pageId="users"><Users /></PageGuard>} />
        <Route path="mcp" element={<PageGuard pageId="mcp"><MasterCoveragePlan /></PageGuard>} />
        <Route path="performance" element={<PageGuard pageId="performance"><PerformancePage /></PageGuard>} />
        <Route path="incentives" element={<PageGuard pageId="incentives"><IncentivesPage /></PageGuard>} />
        <Route path="incentives/archived" element={<PageGuard pageId="incentives"><ArchivedIncentives /></PageGuard>} />
        <Route path="incentives/:programId" element={<PageGuard pageId="incentives"><IncentiveDetails /></PageGuard>} />

        {/* Logistics & Delivery Routes */}
        <Route path="logistics/manning" element={<PageGuard pageId="logistics_manning"><ManningPage /></PageGuard>} />
        <Route path="logistics/schedule" element={<PageGuard pageId="logistics_schedule"><DeliverySchedulePage /></PageGuard>} />
        <Route path="logistics/deliveries" element={<PageGuard pageId="logistics_deliveries"><DeliveriesPage /></PageGuard>} />
        <Route path="logistics/picklist" element={<PageGuard pageId="logistics_picklist"><PicklistPage /></PageGuard>} />
        <Route path="logistics/ddrms" element={<PageGuard pageId="logistics_ddrms"><DDRMSPage /></PageGuard>} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <AppRoutes />
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
