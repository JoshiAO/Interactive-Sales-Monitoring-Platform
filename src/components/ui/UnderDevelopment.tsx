import React from 'react';
import { Truck, Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UnderDevelopmentProps {
  title?: string;
  description?: string;
}

export const UnderDevelopment: React.FC<UnderDevelopmentProps> = ({
  title = "Logistics & Delivery System",
  description = "This module is currently under active development and optimization. Real-time delivery tracking, automated picklists, manning schedules, and DDRMS reporting will be available soon."
}) => {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in flex-center" style={{ minHeight: '70vh', padding: '24px' }}>
      <div 
        className="glass-panel" 
        style={{ 
          maxWidth: '520px', 
          width: '100%', 
          padding: '40px 32px', 
          textAlign: 'center', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: '20px',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
        }}
      >
        <div style={{ 
          width: '72px', 
          height: '72px', 
          borderRadius: '50%', 
          background: 'rgba(234, 179, 8, 0.12)', 
          border: '1px solid rgba(234, 179, 8, 0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#facc15'
        }}>
          <Truck size={36} />
        </div>

        <div>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            letterSpacing: '0.1em', 
            textTransform: 'uppercase', 
            background: 'rgba(234, 179, 8, 0.15)', 
            color: '#facc15', 
            padding: '4px 12px', 
            borderRadius: '16px',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px'
          }}>
            <Construction size={14} /> Under Development
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--text-main)' }}>
            {title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            {description}
          </p>
        </div>

        <button 
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{ 
            marginTop: '12px', 
            padding: '10px 24px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default UnderDevelopment;
