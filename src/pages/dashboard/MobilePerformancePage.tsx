import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PerformancePanel from '../../components/layout/PerformancePanel';

const MobilePerformancePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-dark)', overflow: 'hidden' }}>
      {/* Header */}
      <header className="glass-panel" style={{ padding: '0 16px', height: '60px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', borderRadius: 0, zIndex: 50, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
          <span style={{ fontSize: '16px', fontWeight: 500 }}>Back</span>
        </button>
      </header>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
        <PerformancePanel className="" style={{ maxWidth: '100%', borderLeft: 'none' }} />
      </div>
    </div>
  );
};

export default MobilePerformancePage;
