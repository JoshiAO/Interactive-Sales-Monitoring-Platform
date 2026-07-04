import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Archive, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ArchivedIncentives: React.FC = () => {
  const navigate = useNavigate();
  const [archivedPrograms, setArchivedPrograms] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const q = query(collection(db, 'incentives_programs'), where('status', '==', 'archived'));
        const snap = await getDocs(q);
        const archived: Record<string, unknown>[] = [];
        
        snap.forEach(doc => {
          archived.push({ id: doc.id, ...doc.data() });
        });
        
        setArchivedPrograms(archived);
      } catch (err) {
        console.error("Error fetching programs", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPrograms();
  }, []);

  return (
    <div style={{ paddingBottom: '40px' }}>
      <button 
        onClick={() => navigate('/incentives')} 
        style={{ 
          marginBottom: '24px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 0',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: 500,
          transition: 'all 0.2s ease',
          transform: 'translateX(0)'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = 'var(--text-main)';
          e.currentTarget.style.transform = 'translateX(-4px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <ArrowLeft size={18} /> Back to Active Programs
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Archive size={28} color="var(--text-muted)" />
          Archived Programs
        </h1>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading archives...</div>
      ) : (
        <>
          {archivedPrograms.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
              <Archive size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px 0' }}>No Archives</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>You don't have any archived incentive programs yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {archivedPrograms.map((prog: any) => (
                <div 
                  key={prog.id} 
                  className="glass-panel interactive" 
                  style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} 
                  onClick={() => navigate(`/incentives/${prog.id}`)}
                >
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '18px' }}>{prog.title}</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>{prog.startMonth} to {prog.endMonth}</span>
                      <span>{prog.description}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ArchivedIncentives;
