import React from 'react';

export const PageSkeleton = () => {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ width: '200px', height: '28px', borderRadius: '6px' }}></div>
          <div className="skeleton" style={{ width: '300px', height: '16px', borderRadius: '6px', maxWidth: '100%' }}></div>
        </div>
        <div className="skeleton desktop-only" style={{ width: '120px', height: '36px', borderRadius: '18px' }}></div>
      </div>

      {/* Stats Cards Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton" style={{ width: '40%', height: '14px', borderRadius: '4px' }}></div>
            <div className="skeleton" style={{ width: '80%', height: '28px', borderRadius: '6px' }}></div>
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ flex: '2 1 400px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <div className="skeleton" style={{ width: '30%', height: '20px', borderRadius: '4px', marginBottom: '24px' }}></div>
          <div className="skeleton" style={{ width: '100%', flex: 1, borderRadius: '8px' }}></div>
        </div>
        <div className="glass-panel" style={{ flex: '1 1 250px', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <div className="skeleton" style={{ width: '50%', height: '20px', borderRadius: '4px', marginBottom: '24px' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
             <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
             <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
             <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
