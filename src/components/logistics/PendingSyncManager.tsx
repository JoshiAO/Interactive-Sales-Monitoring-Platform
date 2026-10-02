import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, X, AlertCircle, Trash2 } from 'lucide-react';
import { getAllDrafts, deleteDraft } from '../../utils/indexedDB';
import type { LocalDraft } from '../../utils/indexedDB';
import { db } from '../../firebase/config';
import { doc, writeBatch } from 'firebase/firestore';

export const PendingSyncManager: React.FC = () => {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadDrafts = async () => {
    const data = await getAllDrafts();
    setDrafts(data);
  };

  useEffect(() => {
    loadDrafts();
    // Setup an interval to periodically check for drafts (since we can't easily listen to IndexedDB changes across tabs without BroadcastChannel)
    const interval = setInterval(loadDrafts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteDraft = async (id: string) => {
    if (confirm('Are you sure you want to delete this draft? It will not be synced to the cloud.')) {
      await deleteDraft(id);
      await loadDrafts();
      if (drafts.length === 1) { // Will be 0 after loadDrafts finishes, but we can proactively close it
        setShowPanel(false);
      }
    }
  };

  const handleSync = async () => {
    if (drafts.length === 0) return;
    setSyncing(true);
    try {
      const batch = writeBatch(db);
      
      drafts.forEach((draft) => {
        let collectionName = '';
        switch (draft.type) {
          case 'manning': collectionName = 'logistics_manning'; break;
          case 'picklist': collectionName = 'logistics_picklists'; break;
          case 'schedule': collectionName = 'logistics_schedules'; break;
          case 'ddrms': collectionName = 'logistics_ddrms'; break;
          case 'deliveries': collectionName = 'logistics_deliveries_status'; break; // pseudo table for updates
          case 'collection': collectionName = 'logistics_collections'; break;
        }
        
        if (collectionName) {
          // If it has an ID inside data, use it, otherwise use a clean slug
          const docId = draft.data.id || draft.id.replace(/[^a-zA-Z0-9_-]/g, '_');
          const ref = doc(db, collectionName, docId);
          // For deliveries status updates, we might need a merge
          if (draft.type === 'deliveries') {
            batch.set(doc(db, 'logistics_ddrms', draft.data.ddrmsId), {
              invoices: draft.data.invoices
            }, { merge: true });
          } else {
            const dataToSync = { ...draft.data };
            if (dataToSync.status === 'Draft') {
              dataToSync.status = 'Submitted';
            }
            batch.set(ref, dataToSync, { merge: true });

            // Automatically assign child DDRMS when a schedule is synced
            if (draft.type === 'schedule' && draft.data.rescheduledDdrmsIds?.length > 0) {
              draft.data.rescheduledDdrmsIds.forEach((ddrmsId: string) => {
                batch.update(doc(db, 'logistics_ddrms', ddrmsId), {
                  plateNumber: draft.data.plateNumber,
                  driverName: draft.data.driverName || '',
                  noOfHelpers: draft.data.helpers?.length || 0,
                  deliveryDate: draft.data.date,
                  routeCity: draft.data.route,
                  status: 'Submitted'
                });
              });
            }
          }
        }
      });

      await batch.commit();

      // Clear synced drafts from IDB
      for (const draft of drafts) {
        await deleteDraft(draft.id);
      }
      
      await loadDrafts();
      setShowPanel(false);
      alert('All pending data successfully synchronized to the cloud!');
    } catch (err: any) {
      console.error('Sync failed:', err);
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (drafts.length === 0) {
    return null; // Don't show if nothing to sync
  }

  return (
    <>
      <div 
        onClick={() => setShowPanel(!showPanel)}
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '280px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          padding: '10px 20px',
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 'fit-content',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 9999,
          transition: 'all 0.3s ease',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>Pending Sync</span>

        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: 'var(--accent-danger)',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--bg-panel)'
        }}>
          {drafts.length}
        </div>
      </div>

      {showPanel && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '280px',
          width: '320px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
          zIndex: 9998,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} color="var(--accent-warning)" />
              Offline Drafts ({drafts.length})
            </h3>
            <button onClick={() => setShowPanel(false)} className="btn-icon">
              <X size={16} />
            </button>
          </div>
          
          <div style={{ padding: '16px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
              These records are saved locally and need to be synchronized with the cloud database.
            </p>
            {drafts.map((d) => (
              <div key={d.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>
                    {d.type}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>
                    {d.type === 'manning' && `Plate: ${d.data.plateNumber}`}
                    {d.type === 'picklist' && `Picklist: #${d.data.picklistNumber}`}
                    {d.type === 'schedule' && `Plate: ${d.data.plateNumber} (Date: ${d.data.date})`}
                    {d.type === 'ddrms' && `DDRMS: #${d.data.ddrmsNumber}`}
                    {d.type === 'deliveries' && `Delivery Status Update for DDRMS: ${d.data.ddrmsId}`}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Saved: {new Date(d.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteDraft(d.id)}
                  className="btn-icon hover-bright" 
                  title="Delete Draft"
                  style={{ color: 'var(--accent-danger)', marginLeft: '12px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
            <button 
              onClick={handleSync}
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
              disabled={syncing}
            >
              {syncing ? <><RefreshCw size={16} className="animate-spin" /> Syncing...</> : <><Cloud size={16} /> Sync All to Cloud</>}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
