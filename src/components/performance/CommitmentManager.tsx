import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Check, X, Clock, AlertCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import GamificationInfoModal from './GamificationInfoModal';

interface CommitmentManagerProps {
  data: any;
  activeTab: 'STT' | 'UBA' | 'VD30';
  selectedWeek: number;
}

const CommitmentManager: React.FC<CommitmentManagerProps> = ({ data, activeTab, selectedWeek }) => {
  const { role, currentUser, name, photoURL } = useAuth();
  
  const [proposedTarget, setProposedTarget] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const monthKey = data?.cobDate ? data.cobDate.substring(0, 7) : new Date().toISOString().substring(0, 7); // e.g. "2026-06"
  const metricKey = activeTab.toLowerCase();

  const [liveCommitments, setLiveCommitments] = useState<any>(data.weeklyCommitments || {});

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'weekly_commitments', monthKey), (docSnap) => {
      if (docSnap.exists()) {
        setLiveCommitments(docSnap.data());
      } else {
        setLiveCommitments({});
      }
    });
    return () => unsubscribe();
  }, [monthKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!currentUser?.uid) return null;

  // For supervisor: get their own commitment
  const myCommitments = liveCommitments ? liveCommitments[currentUser.uid] : null;
  const myMetricCommitments = myCommitments ? myCommitments[metricKey] : null;
  const myWeekData = myMetricCommitments ? myMetricCommitments[selectedWeek.toString()] : null;
  const myStatus = myWeekData?.status || 'none';

  const isApproved = myStatus === 'approved';
  const isPending = myStatus === 'pending';

  const handlePropose = async () => {
    if (!proposedTarget || isNaN(Number(proposedTarget))) return;
    setIsSaving(true);

    try {
      const docRef = doc(db, 'weekly_commitments', monthKey);

      const updatePayload = {
        [currentUser.uid]: {
          [metricKey]: {
            [selectedWeek]: {
              target: Number(proposedTarget),
              status: 'pending',
              proposedBy: name || currentUser?.email || 'Unknown',
              proposedByAvatar: photoURL || '',
            }
          }
        }
      };

      await setDoc(docRef, updatePayload, { merge: true });
      setProposedTarget('');
      setIsSaving(false);
    } catch (err: any) {
      console.error(err);
      alert('Failed to propose target: ' + err.message);
      setIsSaving(false);
    }
  };

  const handleManagerAction = async (supervisorUid: string, newStatus: 'approved' | 'rejected') => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'weekly_commitments', monthKey);
      const updatePayload = {
        [supervisorUid]: {
          [metricKey]: {
            [selectedWeek]: {
              status: newStatus
            }
          }
        }
      };
      await setDoc(docRef, updatePayload, { merge: true });
      setIsSaving(false);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update target status: ' + err.message);
      setIsSaving(false);
    }
  };

  // Find all pending/approved proposals for the selected week across all supervisors
  const allProposals: { uid: string, data: any }[] = [];
  if (liveCommitments) {
    Object.keys(liveCommitments).forEach(uid => {
      const supervisorCommitment = liveCommitments[uid];
      if (supervisorCommitment && supervisorCommitment[metricKey] && supervisorCommitment[metricKey][selectedWeek.toString()]) {
        allProposals.push({
          uid,
          data: supervisorCommitment[metricKey][selectedWeek.toString()]
        });
      }
    });
  }

  return (
    <div className="glass-panel" style={{ padding: '24px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Commitment Settings
            <button onClick={() => setShowInfo(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--accent-primary)' }} title="View Gamification & Logic Rules">
              <Info size={18} />
            </button>
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Propose and approve weekly targets for {activeTab}</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {role !== 'supervisor' && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-muted)', cursor: 'pointer' }}
              title="Refresh Data"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>

      {role === 'supervisor' ? (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
          <div style={{ flex: 1, padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Current Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
              {myStatus === 'approved' && <Check size={20} className="text-accent-success" />}
              {myStatus === 'pending' && <Clock size={20} className="text-accent-warning" />}
              {myStatus === 'rejected' && <X size={20} className="text-accent-danger" />}
              {myStatus === 'none' && <AlertCircle size={20} className="text-text-muted" />}
              <span style={{
                color: myStatus === 'approved' ? 'var(--accent-success)' : myStatus === 'pending' ? 'var(--accent-warning)' : myStatus === 'rejected' ? 'var(--accent-danger)' : 'var(--text-muted)'
              }}>
                {myStatus.charAt(0).toUpperCase() + myStatus.slice(1)}
              </span>
            </div>
            {myWeekData?.target && (
              <div style={{ marginTop: '8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                {myWeekData.target}% Target
                {myWeekData.proposedBy && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
                    {myWeekData.proposedByAvatar ? (
                      <img src={myWeekData.proposedByAvatar} alt="avatar" style={{ width: '16px', height: '16px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--text-muted)' }}>
                        {myWeekData.proposedBy.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      Proposed by: <span style={{ color: 'var(--text-main)' }}>{myWeekData.proposedBy}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            {isPending ? (
              <div style={{ flex: 1, padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                Pending manager approval for this week's target.
              </div>
            ) : (
              <div style={{ flex: 1, padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                {isApproved && (
                  <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--accent-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '4px' }}>
                    Note: Proposing a new target will overwrite the currently approved target and require approval again.
                  </div>
                )}
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Propose Target (%)</label>
                    <input
                      type="number"
                      placeholder="e.g. 17"
                      value={proposedTarget}
                      onChange={(e) => setProposedTarget(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      disabled={isSaving || !proposedTarget}
                      onClick={handlePropose}
                      className="btn-primary"
                      style={{ padding: '10px 24px', height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Propose'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {allProposals.length === 0 ? (
            <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', textAlign: 'center', minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No supervisor proposals found for Week {selectedWeek}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {allProposals.map(p => (
                <div key={p.uid} style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Supervisor</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.data.proposedByAvatar ? (
                          <img src={p.data.proposedByAvatar} alt="avatar" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
                            {p.data.proposedBy?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{p.data.proposedBy}</span>
                      </div>
                    </div>
                    <div style={{ background: p.data.status === 'approved' ? 'rgba(34,197,94,0.1)' : p.data.status === 'pending' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px', color: p.data.status === 'approved' ? 'var(--accent-success)' : p.data.status === 'pending' ? 'var(--accent-warning)' : 'var(--accent-danger)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {p.data.status === 'approved' && <Check size={12} />}
                      {p.data.status === 'pending' && <Clock size={12} />}
                      {p.data.status === 'rejected' && <X size={12} />}
                      {p.data.status.toUpperCase()}
                    </div>
                  </div>

                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '16px' }}>
                    {p.data.target}% <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>Target</span>
                  </div>

                  {p.data.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleManagerAction(p.uid, 'approved')}
                        disabled={isSaving}
                        className="btn-primary"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--accent-success)', padding: '8px' }}
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Approve</>}
                      </button>
                      <button
                        onClick={() => handleManagerAction(p.uid, 'rejected')}
                        disabled={isSaving}
                        className="btn-secondary"
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent-danger)', borderColor: 'var(--accent-danger)', padding: '8px' }}
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <><X size={14} /> Reject</>}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showInfo && <GamificationInfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
};

export default CommitmentManager;
