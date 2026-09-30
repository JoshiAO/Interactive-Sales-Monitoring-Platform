import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface PageGuardProps {
  pageId: string;
  children: React.ReactNode;
}

export const PageGuard: React.FC<PageGuardProps> = ({ pageId, children }) => {
  const { pages, loading, canAccess } = useUI();
  const { role } = useAuth();

  if (loading) return <div className="flex-center min-h-screen">Loading...</div>;
  if (!role) return <Navigate to="/login" replace />;

  const page = pages.find(p => p.id === pageId);
  
  if (page) {
    if (!page.visible && role.toLowerCase() !== 'admin') {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100vh' }}>
          {/* Overlay to block interaction */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
             <div className="glass-panel" style={{ padding: '24px 40px', textAlign: 'center', pointerEvents: 'auto', border: '1px solid var(--accent-warning)', boxShadow: '0 0 30px rgba(245, 158, 11, 0.1)' }}>
                <h3 style={{ margin: 0, color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '18px' }}>
                  <AlertTriangle size={20} /> Preview Mode
                </h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '14px', lineHeight: 1.5 }}>
                  This page is currently disabled in Global Settings.<br/>
                  You are viewing a non-interactive preview.
                </p>
             </div>
          </div>
          {/* Dimmed, un-clickable page content */}
          <div style={{ opacity: 0.4, pointerEvents: 'none', height: '100%' }}>
            {children}
          </div>
        </div>
      );
    }

    // Check Role Access
    if (!canAccess(pageId, role, false)) {
      return (
        <div className="flex-center min-h-screen">
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--accent-danger)' }}>Access Denied</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Your current role ({role}) does not have permission to view this page.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
