import React, { useState, useEffect } from 'react';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Gift, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIncentiveDashboard } from '../../hooks/useIncentiveDashboard';

const ProgramPreview: React.FC<{ program: any }> = ({ program }) => {
  const { dashboardData, loading } = useIncentiveDashboard(program.id);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);

  if (loading) {
    return (
      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
         <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px', width: '100%' }}>
           <div className="skeleton" style={{ height: '20px', width: '150px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
         </div>
         <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', width: '100%' }}>
           <div className="skeleton" style={{ height: '16px', width: '60px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
           <div className="skeleton" style={{ height: '16px', width: '60px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
           <div className="skeleton" style={{ height: '16px', width: '60px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }} />
         </div>
      </div>
    );
  }

  const groupKeys = Object.keys(program.trackingGroups || {});
  if (groupKeys.length === 0) return null;

  const currentGroupKey = groupKeys[activeGroupIndex];
  const groupDef = program.trackingGroups[currentGroupKey];

  let target = 0;
  let actual = 0;

  dashboardData?.salesmen?.forEach((s: any) => {
    if (s.trackingResults && s.trackingResults[currentGroupKey]) {
      target += s.trackingResults[currentGroupKey].targetValue || 0;
      actual += (groupDef.targetType === 'STT' ? (s.trackingResults[currentGroupKey].actualSTT || 0) : (s.trackingResults[currentGroupKey].actualUBA || 0));
    }
  });

  const index = target > 0 ? (actual / target) * 100 : (actual > 0 ? 100 : 0);

  const formatCurrency = (val: number) => groupDef.targetType === 'STT' || groupDef.targetType === 'Mixed' ? `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val.toLocaleString();

  return (
    <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '400px' }}>
       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px', width: '100%' }}>
         {groupKeys.length > 1 && (
           <button 
             onClick={(e) => { e.stopPropagation(); setActiveGroupIndex(prev => prev > 0 ? prev - 1 : groupKeys.length - 1); }}
             style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
           >
             <ChevronLeft size={20} />
           </button>
         )}
         
         <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 12px' }}>
           {groupDef.name}
         </div>

         {groupKeys.length > 1 && (
           <button 
             onClick={(e) => { e.stopPropagation(); setActiveGroupIndex(prev => prev < groupKeys.length - 1 ? prev + 1 : 0); }}
             style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
           >
             <ChevronRight size={20} />
           </button>
         )}
       </div>

       <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, width: '100%' }}>
         <span>TGT: <span style={{ color: 'var(--text-main)', fontSize: '14px' }}>{formatCurrency(target)}</span></span>
         <span>ACT: <span style={{ color: 'var(--accent-primary)', fontSize: '14px' }}>{formatCurrency(actual)}</span></span>
         <span>INX: <span style={{ color: 'var(--accent-success)', fontSize: '14px' }}>{index.toFixed(1)}%</span></span>
       </div>
    </div>
  );
};

const IncentivesPage: React.FC = () => {
  const navigate = useNavigate();
  const [activePrograms, setActivePrograms] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const q = query(collection(db, 'incentives_programs'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const active: Record<string, unknown>[] = [];
        
        snap.forEach(doc => {
          active.push({ id: doc.id, ...doc.data() });
        });
        
        setActivePrograms(active);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Gift size={28} color="var(--accent-primary)" />
          Incentives Program
        </h1>
        <button 
          onClick={() => navigate('/incentives/archived')}
          className="btn" 
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--text-muted)',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'var(--text-main)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <Archive size={18} />
          Archived
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Loading programs...</div>
      ) : (
        <>
          {activePrograms.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
              <Gift size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
              <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px 0' }}>No Active Programs</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>There are currently no active incentive programs running.</p>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', width: '100%', height: '500px', display: 'flex', justifyContent: 'center', alignItems: 'center', perspective: '1200px', overflow: 'hidden', padding: '20px 0' }}>
              
              {/* Left Navigation Button */}
              <button 
                onClick={() => {
                  setCurrentIndex(prev => Math.max(prev - 1, 0));
                  setActiveIndex(null);
                }}
                disabled={currentIndex === 0}
                style={{ 
                  position: 'absolute', left: '40px', zIndex: 1000,
                  background: 'none', border: 'none', padding: '12px',
                  color: currentIndex === 0 ? 'rgba(255,255,255,0.1)' : 'white', cursor: currentIndex === 0 ? 'default' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: 'scale(1)'
                }}
                onMouseEnter={e => { if (currentIndex !== 0) { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.color = 'var(--accent-primary)'; } }}
                onMouseLeave={e => { if (currentIndex !== 0) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'white'; } }}
              >
                <ChevronLeft size={48} strokeWidth={1.5} />
              </button>

              {/* Right Navigation Button */}
              <button 
                onClick={() => {
                  setCurrentIndex(prev => Math.min(prev + 1, activePrograms.length - 1));
                  setActiveIndex(null);
                }}
                disabled={currentIndex === activePrograms.length - 1}
                style={{ 
                  position: 'absolute', right: '40px', zIndex: 1000,
                  background: 'none', border: 'none', padding: '12px',
                  color: currentIndex === activePrograms.length - 1 ? 'rgba(255,255,255,0.1)' : 'white', cursor: currentIndex === activePrograms.length - 1 ? 'default' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: 'scale(1)'
                }}
                onMouseEnter={e => { if (currentIndex !== activePrograms.length - 1) { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.color = 'var(--accent-primary)'; } }}
                onMouseLeave={e => { if (currentIndex !== activePrograms.length - 1) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = 'white'; } }}
              >
                <ChevronRight size={48} strokeWidth={1.5} />
              </button>

              {activePrograms.map((prog: any, i: number) => {
                const diff = i - currentIndex;
                const absDiff = Math.abs(diff);
                const isCenter = diff === 0;
                const isActive = isCenter && activeIndex === i;
                
                // Calculate 3D transforms
                const translateX = diff * 260; // Spread distance
                const scale = isCenter ? 1 : Math.max(1 - (absDiff * 0.15), 0.5);
                const rotateY = diff === 0 ? 0 : (diff > 0 ? -35 : 35);
                const zIndex = 100 - absDiff;
                const opacity = isCenter ? 1 : Math.max(1 - (absDiff * 0.3), 0);

                return (
                  <div 
                    key={prog.id} 
                    onClick={() => {
                      if (!isCenter) {
                         setCurrentIndex(i);
                         setActiveIndex(null);
                      } else if (!isActive) {
                         setActiveIndex(i);
                      }
                    }}
                    style={{ 
                      position: 'absolute',
                      width: '340px',
                      height: '420px',
                      cursor: isActive ? 'default' : 'pointer',
                      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 1) 100%)',
                      borderRadius: '24px',
                      overflow: 'hidden',
                      border: isActive ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                      boxShadow: isActive ? '0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(59, 130, 246, 0.3)' : '0 10px 30px rgba(0,0,0,0.4)',
                      transition: 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      transform: `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
                      zIndex,
                      opacity,
                      pointerEvents: opacity === 0 ? 'none' : 'auto',
                    }}
                    onMouseEnter={e => {
                      if (isCenter && !isActive) {
                        e.currentTarget.style.transform = `translateX(${translateX}px) scale(1.05) rotateY(0deg) translateY(-10px)`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (isCenter && !isActive) {
                        e.currentTarget.style.transform = `translateX(${translateX}px) scale(1) rotateY(0deg)`;
                      }
                    }}
                  >
                    <div style={{ 
                      width: '100%', 
                      height: isActive ? '180px' : '100%', 
                      overflow: 'hidden',
                      transition: 'height 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      position: 'relative'
                    }}>
                      {prog.bannerUrl ? (
                        <img 
                          src={prog.bannerUrl} 
                          alt={prog.title} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            filter: isActive ? 'grayscale(0%)' : 'grayscale(100%) opacity(0.7)',
                            transition: 'all 0.6s ease' 
                          }} 
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(45deg, var(--bg-panel), var(--bg-panel-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Gift size={64} color="var(--text-muted)" opacity={0.3} />
                        </div>
                      )}

                      {/* Title overlay for inactive cards */}
                      {!isActive && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '30px 20px', background: 'linear-gradient(to top, rgba(15,23,42,1) 0%, rgba(15,23,42,0) 100%)', display: 'flex', justifyContent: 'center' }}>
                          <h3 style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '22px', fontWeight: 600, textAlign: 'center', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                            {prog.title}
                          </h3>
                        </div>
                      )}
                    </div>

                    <div style={{ 
                      padding: '24px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '16px', 
                      height: '240px',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? 'translateY(0)' : 'translateY(40px)',
                      transition: 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                      pointerEvents: isActive ? 'auto' : 'none'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '22px', fontWeight: 600 }}>{prog.title}</h3>
                        <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>ACTIVE</span>
                      </div>
                      
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {prog.description}
                      </p>
                      
                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/incentives/${prog.id}`);
                          }}
                          className="program-btn btn btn-primary" 
                          style={{ 
                            padding: '12px 32px',
                            borderRadius: '24px',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                            fontWeight: 600,
                            width: '100%',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          Show Program
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              width: '100%', 
              marginTop: '20px', 
              height: '60px',
              opacity: activeIndex !== null ? 1 : 0,
              visibility: activeIndex !== null ? 'visible' : 'hidden',
              transition: 'opacity 0.3s ease, visibility 0.3s ease',
              pointerEvents: activeIndex !== null ? 'auto' : 'none'
            }}>
              {activePrograms.length > 0 && (
                <ProgramPreview program={activePrograms[currentIndex]} />
              )}
            </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default IncentivesPage;
