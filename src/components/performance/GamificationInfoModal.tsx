import React from 'react';
import { createPortal } from 'react-dom';
import { X, Info, Medal, Target, TrendingUp } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const GamificationInfoModal: React.FC<Props> = ({ onClose }) => {
  return createPortal(
    <div className="animate-fade-in-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={24} color="var(--accent-primary)" />
              Gamification & Logic Rules
            </h2>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Understanding how commitments, points, and rankings work.</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

        <div>
          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Target size={20} color="var(--accent-warning)" />
            Supervisor Target Proposal (Cumulative)
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px 0' }}>
            When proposing weekly targets, the values must be <strong>cumulative (added up)</strong> over the month. They are not isolated weekly goals.
          </p>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}>
            <div style={{ marginBottom: '8px', color: 'var(--text-muted)' }}><strong>Example Scenario:</strong> Your actual cascaded targets for the month are 20%, 25%, 25%, and 30%.</div>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-main)', lineHeight: '1.8' }}>
              <li><strong>Week 1:</strong> You propose <strong>20%</strong></li>
              <li><strong>Week 2:</strong> You propose <strong>45%</strong> <em>(20% + 25%)</em></li>
              <li><strong>Week 3:</strong> You propose <strong>70%</strong> <em>(45% + 25%)</em></li>
              <li><strong>Week 4:</strong> You propose <strong>100%</strong> <em>(70% + 30%)</em></li>
            </ul>
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <TrendingUp size={20} color="var(--accent-success)" />
            Color Borders & Visual Hierarchy
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            Salesmen cards are highlighted with colored borders based on their <strong>previous week's performance rank</strong>. This visually rewards top performers.
          </p>
          <ul style={{ margin: '12px 0 0 0', paddingLeft: '20px', color: 'var(--text-muted)', lineHeight: '1.8', fontSize: '14px' }}>
            <li><strong style={{ color: '#FBBF24' }}>Gold Border:</strong> Rank 1 (Top Performer)</li>
            <li><strong style={{ color: '#9CA3AF' }}>Silver Border:</strong> Rank 2</li>
            <li><strong style={{ color: '#B45309' }}>Bronze Border:</strong> Rank 3</li>
          </ul>
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <Medal size={20} color="#3B82F6" />
            Medals & Points Distribution
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px 0' }}>
            At the end of every week, performance is evaluated and points are distributed. These points accumulate throughout the month to determine the final monthly rankings.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
              <strong style={{ color: '#FBBF24', display: 'block', marginBottom: '4px' }}>Gold Medal (Rank 1)</strong>
              <div style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 'bold' }}>+5 Points</div>
            </div>
            <div style={{ background: 'rgba(156, 163, 175, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(156, 163, 175, 0.2)' }}>
              <strong style={{ color: '#9CA3AF', display: 'block', marginBottom: '4px' }}>Silver Medal (Rank 2)</strong>
              <div style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 'bold' }}>+3 Points</div>
            </div>
            <div style={{ background: 'rgba(180, 83, 9, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(180, 83, 9, 0.2)' }}>
              <strong style={{ color: '#B45309', display: 'block', marginBottom: '4px' }}>Bronze Medal (Rank 3)</strong>
              <div style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 'bold' }}>+1 Point</div>
            </div>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <strong style={{ color: '#3B82F6', display: 'block', marginBottom: '4px' }}>Rank 4-10</strong>
              <div style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: 'bold' }}>+0 Points</div>
            </div>
          </div>
        </div>
        
      </div>
    </div>,
    document.body
  );
};

export default GamificationInfoModal;
