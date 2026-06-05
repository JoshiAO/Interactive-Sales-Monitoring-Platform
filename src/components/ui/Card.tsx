import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
}

export const Card: React.FC<CardProps> = ({ title, value, subtitle, icon, trend }) => {
  return (
    <div className="glass-panel" style={{ padding: '20px', containerType: 'inline-size' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <h4 style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '14px', margin: 0 }}>{title}</h4>
        {icon && <div style={{ color: 'var(--accent-primary)' }}>{icon}</div>}
      </div>
      <div 
        title={String(value)}
        style={{ 
          fontSize: 'clamp(16px, 12cqi, 28px)', 
          fontWeight: 600, 
          color: 'var(--text-main)', 
          marginBottom: '8px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {value}
      </div>
      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          {trend && (
            <span style={{ color: trend.value >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
              {trend.value >= 0 ? '+' : ''}{trend.value}%
            </span>
          )}
          {subtitle && <span style={{ color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
