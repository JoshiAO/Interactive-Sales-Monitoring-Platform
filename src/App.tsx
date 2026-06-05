import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Activation from './pages/Activation';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Home from './pages/dashboard/Home';
import Sales from './pages/dashboard/Sales';
import VD30 from './pages/dashboard/VD30';
import Customers from './pages/dashboard/Customers';
import DataUpload from './pages/admin/DataUpload';
import Users from './pages/admin/Users';

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
        <Route index element={<Home />} />
        <Route path="sales" element={<Sales />} />
        <Route path="vd30" element={<VD30 />} />
        <Route path="customers" element={<Customers />} />
        <Route path="data" element={<DataUpload />} />
        <Route path="users" element={<Users />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
