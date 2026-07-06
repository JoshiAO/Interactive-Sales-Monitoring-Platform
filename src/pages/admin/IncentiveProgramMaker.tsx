import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { Plus, Trash2, Edit2, Save, Image as ImageIcon, Loader2, X, Archive, Check, Minus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

interface TrackingGroup {
  id: string;
  name: string;
  definitionType: 'category' | 'products';
  items: string[];
  targetType: 'STT' | 'UBA';
  targetValue?: number;
  individualTargets?: Record<string, any>;
  minDropSize: number;
  ubaMeasureType?: 'Month-on-month' | 'Everbought';
  channels?: string[];
}

interface IncentiveProgram {
  id: string;
  title: string;
  description: string;
  startMonth: string;
  endMonth: string;
  status: string;
  bannerUrl: string;
  trackingGroups: Record<string, TrackingGroup>;
  participatingSalesmen: string[];
}

const IncentiveProgramMaker: React.FC = () => {
  const [programs, setPrograms] = useState<IncentiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<IncentiveProgram>>({
    status: 'active',
    trackingGroups: {},
    participatingSalesmen: []
  });
  const [salesmen, setSalesmen] = useState<{id: string, name: string, code: string, team: string, branch: string}[]>([]);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  
  const [categories, setCategories] = useState<string[]>([]);
  const [channelsList, setChannelsList] = useState<string[]>([]);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});

  const [selectorModal, setSelectorModal] = useState<{ groupId: string, type: 'category' | 'channel' | 'product' } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  
  const [individualTargetsModal, setIndividualTargetsModal] = useState<string | null>(null);
  const [individualTargetsSearch, setIndividualTargetsSearch] = useState('');
  const [individualTargetsSort, setIndividualTargetsSort] = useState<'name' | 'code'>('name');
  const [individualTargetsBranches, setIndividualTargetsBranches] = useState<string[]>([]);
  const [individualTargetsMonth, setIndividualTargetsMonth] = useState<string>('');

  const getMonthsBetween = (start?: string, end?: string) => {
    if (!start || !end) return [];
    const months = [];
    let current = new Date(`${start}-01`);
    const endDate = new Date(`${end}-01`);
    while (current <= endDate) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${yyyy}-${mm}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const availableMonths = getMonthsBetween(formData.startMonth, formData.endMonth);

  useEffect(() => {
    if (individualTargetsModal && availableMonths.length > 0 && !availableMonths.includes(individualTargetsMonth)) {
      setIndividualTargetsMonth(availableMonths[0]);
    }
  }, [individualTargetsModal, formData.startMonth, formData.endMonth]);

  const handleAddTrackingGroup = () => {
    const newId = `group_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      trackingGroups: {
        ...prev.trackingGroups,
        [newId]: {
          id: newId,
          name: '',
          definitionType: 'category',
          items: [],
          targetType: 'STT',
          minDropSize: 0,
          ubaMeasureType: 'Month-on-month'
        }
      }
    }));
  };

  const handleUpdateTrackingGroup = (id: string, updates: Partial<TrackingGroup>) => {
    setFormData(prev => ({
      ...prev,
      trackingGroups: {
        ...prev.trackingGroups,
        [id]: { ...prev.trackingGroups![id], ...updates }
      }
    }));
  };

  const handleDeleteTrackingGroup = (id: string) => {
    setFormData(prev => {
      const newGroups = { ...prev.trackingGroups };
      delete newGroups[id];
      return { ...prev, trackingGroups: newGroups };
    });
  };

  const toggleSalesman = (id: string) => {
    setFormData(prev => {
      const curr = prev.participatingSalesmen || [];
      if (curr.includes(id)) return { ...prev, participatingSalesmen: curr.filter(x => x !== id) };
      return { ...prev, participatingSalesmen: [...curr, id] };
    });
  };

  const toggleAllSalesmen = () => {
    setFormData(prev => {
      if ((prev.participatingSalesmen || []).length === salesmen.length) {
        return { ...prev, participatingSalesmen: [] };
      }
      return { ...prev, participatingSalesmen: salesmen.map(s => s.id) };
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    setUploadingImage(true);
    try {
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => {
              if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              else reject(new Error('Compression failed'));
            }, 'image/jpeg', 0.8);
          };
        };
      });

      const storageRef = ref(storage, `incentives_banners/${Date.now()}_${compressedFile.name}`);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      
      setFormData(prev => ({ ...prev, bannerUrl: url }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!formData.title || !formData.startMonth || !formData.endMonth) {
      alert("Title and duration are required.");
      return;
    }
    setSaving(true);
    try {
      const docId = formData.id || `prog_${Date.now()}`;
      
      // Ensure ubaMeasureType is explicitly saved for UBA targets even if untouched by the user
      const processedTrackingGroups = { ...formData.trackingGroups };
      Object.keys(processedTrackingGroups).forEach(groupId => {
        if (processedTrackingGroups[groupId].targetType === 'UBA' || processedTrackingGroups[groupId].targetType === 'Mixed' as any) {
          if (!processedTrackingGroups[groupId].ubaMeasureType) {
            processedTrackingGroups[groupId].ubaMeasureType = 'Month-on-month';
          }
        }
      });

      const payload: Record<string, any> = { ...formData, trackingGroups: processedTrackingGroups, id: docId };
      
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(doc(db, 'incentives_programs', docId), payload);
      setShowModal(false);
      setFormData({ status: 'active', trackingGroups: {}, participatingSalesmen: [] });
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to save program.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProgram = (prog: IncentiveProgram) => {
    setFormData(prog);
    setShowModal(true);
  };

  const handleArchiveProgram = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this program?")) return;
    try {
      await updateDoc(doc(db, 'incentives_programs', id), { status: 'archived' });
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to archive program.");
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this program?")) return;
    try {
      await deleteDoc(doc(db, 'incentives_programs', id));
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to delete program.");
    }
  };

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'incentives_programs'));
      const progs: IncentiveProgram[] = [];
      snap.forEach(d => {
        const data = d.data() as Omit<IncentiveProgram, 'id'>;
        progs.push({ id: d.id, ...data });
      });
      setPrograms(progs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesmen = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: {id: string, name: string, code: string, team: string, branch: string}[] = [];
      snap.forEach(d => {
        const u = d.data();
        if (u.role === 'salesman' && u.salesmanId) {
          list.push({ 
            id: String(u.salesmanId), 
            name: u.name || String(u.salesmanId),
            code: String(u.salesmanId),
            team: u.team || '',
            branch: u.branch || u.team || 'Unassigned'
          });
        }
      });
      setSalesmen(list.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error("Failed to fetch salesmen:", err);
    }
  };

  const fetchReferences = async () => {
    try {
      const [chanColSnap, mastSnap] = await Promise.all([
        getDocs(collection(db, 'reference_channels')),
        getDoc(doc(db, 'reference_masterlist', 'all'))
      ]);
      
      const chanSet = new Set<string>();
      chanColSnap.forEach(docSnap => {
        if (docSnap.id === 'all') {
          const chanData = docSnap.data();
          Object.values(chanData).forEach((row: any) => {
            if (typeof row === 'object' && row !== null) {
              const c = row.party_classification_description || row.channel || row['Channel'] || row['Channel_Classification'] || row['Channel Classification'] || row['Channel Description'] || row['Customer Channel'] || row.description || row.Description;
              if (c) {
                chanSet.add(String(c).trim());
              } else {
                Object.values(row).forEach(v => {
                  if (typeof v === 'string' && v.length > 2 && isNaN(Number(v))) {
                    chanSet.add(v.trim());
                  }
                });
              }
            } else if (typeof row === 'string') {
              chanSet.add(row.trim());
            }
          });
        } else {
          const row = docSnap.data();
          const c = row.party_classification_description || row.channel || row['Channel'] || row['Channel Description'] || row['Customer Channel'];
          if (c) chanSet.add(String(c).trim());
        }
      });
      setChannelsList(Array.from(chanSet).sort());

      const mastData = mastSnap.exists() ? mastSnap.data() : {};
      const catSet = new Set<string>();
      const pMap: Record<string, string> = {};
      const pCatMap: Record<string, string> = {};
      if (mastData.data) {
        const parsed = JSON.parse(mastData.data);
        Object.entries(parsed).forEach(([code, val]: any) => {
          if (val[0]) pMap[code] = val[0];
          if (val[1]) {
            catSet.add(val[1]);
            pCatMap[code] = val[1];
          }
        });
      }
      setCategories(Array.from(catSet).sort());
      setProductMap(pMap);
      setProductCategoryMap(pCatMap);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPrograms();
    fetchSalesmen();
    fetchReferences();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)' }}>Loading Programs...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ color: 'var(--accent-primary)', fontSize: '18px', margin: '0 0 8px 0' }}>Incentive Programs</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Create and manage special incentive programs, define custom tracking rules, and upload multi-month targets.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> New Program
          </button>
        </div>

        {programs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            No incentive programs found. Click 'New Program' to create one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px' }}>Title</th>
                <th style={{ padding: '12px 8px' }}>Duration</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map(prog => (
                <tr key={prog.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)' }}>{prog.title}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{prog.startMonth} to {prog.endMonth}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: prog.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: prog.status === 'active' ? '#4ade80' : 'var(--text-muted)' }}>
                      {prog.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        title="Edit"
                        onClick={() => handleEditProgram(prog)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '8px', color: '#60a5fa', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      
                      {prog.status === 'active' && (
                        <button 
                          title="Archive"
                          onClick={() => handleArchiveProgram(prog.id)}
                          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '8px', color: '#fbbf24', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Archive size={16} />
                        </button>
                      )}

                      <button 
                        title="Delete"
                        onClick={() => handleDeleteProgram(prog.id)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '8px', color: '#f87171', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Incentive Program">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Program Title</label>
            <input type="text" className="input" placeholder="e.g. Q3 Noodles Bonanza" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Description</label>
            <textarea className="input" rows={3} placeholder="Describe the program..." value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Banner Image</label>
            {formData.bannerUrl ? (
              <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={formData.bannerUrl} alt="Banner Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => setFormData(prev => ({ ...prev, bannerUrl: '' }))}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label 
                style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                  width: '100%', height: '120px', border: '2px dashed var(--border)', borderRadius: '8px', 
                  cursor: uploadingImage ? 'not-allowed' : 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'all 0.2s ease'
                }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; }}
                onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                  const file = e.dataTransfer.files[0];
                  if (file && !uploadingImage) handleImageUpload(file);
                }}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file && !uploadingImage) handleImageUpload(file);
                  }}
                  disabled={uploadingImage}
                />
                {uploadingImage ? (
                  <>
                    <Loader2 size={24} color="var(--accent-primary)" className="animate-spin" style={{ marginBottom: '8px' }} />
                    <span style={{ color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 600 }}>Compressing & Uploading...</span>
                  </>
                ) : (
                  <>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '50%', marginBottom: '12px' }}>
                      <ImageIcon size={24} color="var(--text-muted)" />
                    </div>
                    <span style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>Click to upload or drag and drop</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>PNG, JPG or WEBP (max. 10MB)</span>
                  </>
                )}
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Start Month</label>
              <input type="month" className="input" value={formData.startMonth || ''} onChange={e => setFormData({...formData, startMonth: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>End Month</label>
              <input type="month" className="input" value={formData.endMonth || ''} onChange={e => setFormData({...formData, endMonth: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }} />
            </div>
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h4 style={{ color: 'var(--accent-primary)', margin: '0 0 12px 0' }}>Tracking Groups</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Define how STT and UBA targets are tracked for specific categories or products.</p>
            
            {Object.values(formData.trackingGroups || {}).map(group => (
              <div key={group.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                  <input type="text" placeholder="Group Name (e.g. Premium Noodles)" value={group.name} onChange={e => handleUpdateTrackingGroup(group.id, { name: e.target.value })} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', marginRight: '12px' }} />
                  <button 
                    onClick={() => handleDeleteTrackingGroup(group.id)} 
                    style={{ 
                      color: '#fca5a5', 
                      background: 'rgba(239, 68, 68, 0.15)', 
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px', 
                      padding: '8px 12px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    title="Remove Group"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <select 
                    value={group.definitionType} 
                    onChange={e => handleUpdateTrackingGroup(group.id, { definitionType: e.target.value as any, items: [] })}
                    className="glass-panel"
                    style={{ flex: 1, padding: '8px', borderRadius: '4px' }}
                  >
                    <option value="category">Track by Category</option>
                    <option value="products">Specific Products</option>
                  </select>
                  
                  <select 
                    value={group.targetType} 
                    onChange={e => handleUpdateTrackingGroup(group.id, { targetType: e.target.value as any, ubaMeasureType: e.target.value === 'UBA' || e.target.value === 'Mixed' ? 'Month-on-month' : undefined })}
                    className="glass-panel"
                    style={{ flex: 1, padding: '8px', borderRadius: '4px' }}
                  >
                    <option value="STT">STT (Net Value)</option>
                    <option value="UBA">UBA</option>
                  </select>
                  
                  {group.targetType === 'UBA' && (
                    <select 
                      value={group.ubaMeasureType || 'Month-on-month'} 
                      onChange={e => handleUpdateTrackingGroup(group.id, { ubaMeasureType: e.target.value as any })}
                      className="glass-panel"
                      style={{ flex: 1, padding: '8px', borderRadius: '4px' }}
                    >
                      <option value="Month-on-month">Month-on-month UBA</option>
                      <option value="Everbought">Everbought UBA</option>
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', width: '100px' }}>Target:</div>
                  <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                    <input 
                      type="number" 
                      placeholder={Object.keys(group.individualTargets || {}).length > 0 ? 'Individual Targets Set' : `Global Target ${group.targetType === 'STT' ? '(₱)' : ''}`} 
                      value={group.targetValue || ''} 
                      onChange={e => handleUpdateTrackingGroup(group.id, { targetValue: Number(e.target.value) })} 
                      disabled={Object.keys(group.individualTargets || {}).length > 0}
                      style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', opacity: Object.keys(group.individualTargets || {}).length > 0 ? 0.5 : 1 }} 
                    />
                    <button
                      className="btn"
                      title="Set Individual Targets per Salesman"
                      onClick={() => setIndividualTargetsModal(group.id)}
                      style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: Object.keys(group.individualTargets || {}).length > 0 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span style={{ fontSize: '13px' }}>{Object.keys(group.individualTargets || {}).length > 0 ? 'Edit Targets' : 'Per-Salesman'}</span>
                    </button>
                  </div>
                </div>
                
                {group.definitionType === 'products' && group.targetType === 'UBA' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Minimum Drop Size (per customer per product)</label>
                    <input type="number" value={group.minDropSize || 0} onChange={e => handleUpdateTrackingGroup(group.id, { minDropSize: Number(e.target.value) })} style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }} />
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                  <button 
                    className="btn" 
                    onClick={() => setSelectorModal({ groupId: group.id, type: group.definitionType === 'category' ? 'category' : 'product' })}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', justifyContent: 'flex-start', color: group.items.length > 0 ? 'white' : 'var(--text-muted)' }}
                  >
                    {group.items.length > 0 ? `${group.items.length} ${group.definitionType === 'category' ? 'Categories' : 'Products'} Selected` : `Select ${group.definitionType === 'category' ? 'Categories' : 'Products'}...`}
                  </button>
                  
                  <button 
                    className="btn" 
                    onClick={() => setSelectorModal({ groupId: group.id, type: 'channel' })}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', justifyContent: 'flex-start', color: (group.channels || []).length > 0 ? 'white' : 'var(--text-muted)' }}
                  >
                    {(group.channels || []).length > 0 ? `${group.channels!.length} Channels Selected` : 'All Channels (Default)'}
                  </button>
                </div>
              </div>
            ))}

            <button className="btn" onClick={handleAddTrackingGroup} style={{ width: '100%', border: '1px dashed var(--border)' }}>
              <Plus size={16} /> Add Tracking Group
            </button>
          </div>

          <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ color: 'var(--accent-success)', margin: '0 0 4px 0' }}>Participating Salesmen</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Select the salesmen who are eligible for this program.</p>
              </div>
              <button 
                className="btn" 
                onClick={toggleAllSalesmen}
                style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)' }}
              >
                {(formData.participatingSalesmen || []).length === salesmen.length && salesmen.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="Search salesmen..." 
              value={salesmanSearch}
              onChange={e => setSalesmanSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', marginBottom: '16px', fontSize: '13px' }}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {salesmen.filter(s => s.name.toLowerCase().includes(salesmanSearch.toLowerCase())).map(s => {
                const isSelected = (formData.participatingSalesmen || []).includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSalesman(s.id)}
                    style={{
                      background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isSelected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: isSelected ? '#10b981' : 'var(--text-main)',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                    {s.name}
                  </button>
                );
              })}
              {salesmen.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading salesmen...</span>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveProgram} disabled={saving}>
              {saving ? 'Saving...' : <><Save size={16} /> Save Program</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!selectorModal} onClose={() => { setSelectorModal(null); setSelectorSearch(''); setProductCategoryFilter('all'); }} title={`Select ${selectorModal?.type === 'category' ? 'Categories' : selectorModal?.type === 'channel' ? 'Channels' : 'Products'}`}>
        {selectorModal && (() => {
          const group = formData.trackingGroups?.[selectorModal.groupId];
          if (!group) return null;
          
          const isProd = selectorModal.type === 'product';
          const options = selectorModal.type === 'category' ? categories : selectorModal.type === 'channel' ? channelsList : Object.keys(productMap);
          const selected = selectorModal.type === 'channel' ? (group.channels || []) : group.items;
          
          const toggleSelection = (item: string) => {
            if (selectorModal.type === 'channel') {
              const newChannels = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
              handleUpdateTrackingGroup(group.id, { channels: newChannels });
            } else {
              const newItems = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
              handleUpdateTrackingGroup(group.id, { items: newItems });
            }
          };

          const toggleAll = () => {
             if (isProd) return;
             if (selected.length === options.length) {
               if (selectorModal.type === 'category') handleUpdateTrackingGroup(group.id, { items: [] });
               else handleUpdateTrackingGroup(group.id, { channels: [] });
             } else {
               if (selectorModal.type === 'category') handleUpdateTrackingGroup(group.id, { items: options });
               else handleUpdateTrackingGroup(group.id, { channels: options });
             }
          }

          const filteredOptions = isProd 
            ? Object.entries(productMap).filter(([code, desc]) => {
                const matchesSearch = !selectorSearch || code.toLowerCase().includes(selectorSearch.toLowerCase()) || desc.toLowerCase().includes(selectorSearch.toLowerCase());
                const matchesCategory = productCategoryFilter === 'all' || productCategoryMap[code] === productCategoryFilter;
                return matchesSearch && matchesCategory;
              }).slice(0, 50).map(x => x[0])
            : options.filter(o => o.toLowerCase().includes(selectorSearch.toLowerCase()));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder={isProd ? "Search Item Code or Description..." : `Search or add custom ${selectorModal.type}...`}
                  value={selectorSearch}
                  onChange={e => setSelectorSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && selectorSearch.trim() && !isProd) {
                      const val = selectorSearch.trim();
                      if (selectorModal.type === 'category') {
                        if (!categories.includes(val)) setCategories(prev => [...prev, val].sort());
                        const newItems = selected.includes(val) ? selected : [...selected, val];
                        handleUpdateTrackingGroup(group.id, { items: newItems });
                      } else {
                        if (!channelsList.includes(val)) setChannelsList(prev => [...prev, val].sort());
                        const newChannels = selected.includes(val) ? selected : [...selected, val];
                        handleUpdateTrackingGroup(group.id, { channels: newChannels });
                      }
                      setSelectorSearch('');
                    }
                  }}
                  style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', minWidth: '150px' }}
                />
                {isProd && (
                  <select 
                    value={productCategoryFilter}
                    onChange={e => setProductCategoryFilter(e.target.value)}
                    className="glass-panel"
                    style={{ padding: '10px 12px', borderRadius: '6px', width: '180px' }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {!isProd && (
                  <button className="btn" onClick={toggleAll}>
                    {selected.length === options.length && options.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {isProd && selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', maxHeight: '100px', overflowY: 'auto' }}>
                  {selected.map(sel => (
                    <div key={sel} style={{ padding: '4px 8px', background: 'var(--accent-primary)', borderRadius: '4px', fontSize: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {sel}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => toggleSelection(sel)} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px' }}>
                {filteredOptions.map(opt => {
                  const isSel = selected.includes(opt);
                  return (
                    <div 
                      key={opt}
                      onClick={() => toggleSelection(opt)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        background: isSel ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        transition: 'background 0.2s',
                        borderRadius: '4px'
                      }}
                    >
                      {isProd ? (
                        <>
                          <button className="btn" style={{ padding: '4px', background: isSel ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isSel ? 'var(--accent-danger)' : 'var(--accent-primary)', border: `1px solid ${isSel ? 'var(--accent-danger)' : 'var(--accent-primary)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSel ? <Minus size={14} /> : <Plus size={14} />}
                          </button>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'white' }}>{opt}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{productMap[opt] || ''}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '20px', height: '20px', border: `2px solid ${isSel ? 'var(--accent-primary)' : 'var(--border)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? 'var(--accent-primary)' : 'transparent' }}>
                            {isSel && <Check size={14} color="white" strokeWidth={3} />}
                          </div>
                          <span style={{ color: isSel ? 'white' : 'var(--text-muted)', fontWeight: isSel ? 500 : 400 }}>{opt}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No options found. 
                    {selectorSearch ? (
                      <div style={{ marginTop: '8px', color: 'var(--accent-primary)', fontSize: '14px' }}>
                        {isProd ? `No products matching "${selectorSearch}"` : `Press Enter to add "${selectorSearch}" as a custom ${selectorModal.type}.`}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        {isProd ? 'Type to search for products...' : 'Type a name and press Enter to add a custom option.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => { setSelectorModal(null); setSelectorSearch(''); }}
                  style={{ padding: '12px 40px', borderRadius: '30px', boxShadow: '0 8px 16px rgba(59,130,246,0.3)', width: '200px' }}
                >
                  Apply Selection
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!individualTargetsModal} onClose={() => { setIndividualTargetsModal(null); setIndividualTargetsSearch(''); }} title="Set Individual Targets">
        {individualTargetsModal && (() => {
          const group = formData.trackingGroups?.[individualTargetsModal];
          if (!group) return null;
          
          const participating = formData.participatingSalesmen || [];
          const targets = group.individualTargets || {};

          const availableBranches = Array.from(new Set(salesmen.filter(s => participating.includes(s.id)).map(s => s.branch))).filter(Boolean).sort();

          const filteredParticipating = participating.filter(id => {
            const s = salesmen.find(x => x.id === id);
            if (!s) return false;
            const matchesSearch = s.name.toLowerCase().includes(individualTargetsSearch.toLowerCase()) || s.code.toLowerCase().includes(individualTargetsSearch.toLowerCase());
            const matchesBranch = individualTargetsBranches.length === 0 || individualTargetsBranches.includes(s.branch);
            return matchesSearch && matchesBranch;
          }).sort((a, b) => {
            const sA = salesmen.find(x => x.id === a);
            const sB = salesmen.find(x => x.id === b);
            if (!sA || !sB) return 0;
            if (individualTargetsSort === 'name') return sA.name.localeCompare(sB.name);
            return sA.code.localeCompare(sB.code);
          });

          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '65vh' }}>
              <div style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
                Set specific targets for each participating salesman. If left empty, they will fall back to the global target.
              </div>

              {participating.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                  <p style={{ color: 'var(--text-muted)' }}>You must select <strong>Participating Salesmen</strong> at the bottom of the form before you can set individual targets.</p>
                  <button className="btn btn-primary" onClick={() => setIndividualTargetsModal(null)} style={{ marginTop: '16px' }}>Got it</button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        placeholder="Search name or code..."
                        value={individualTargetsSearch}
                        onChange={e => setIndividualTargetsSearch(e.target.value)}
                        style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                      />
                      <select 
                        value={individualTargetsSort}
                        onChange={e => setIndividualTargetsSort(e.target.value as any)}
                        className="glass-panel"
                        style={{ width: '160px', padding: '10px 12px', borderRadius: '6px' }}
                      >
                        <option value="name">Sort by Name</option>
                        <option value="code">Sort by Code</option>
                      </select>
                    </div>

                    <select 
                      value={individualTargetsMonth}
                      onChange={e => setIndividualTargetsMonth(e.target.value)}
                      className="glass-panel"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px' }}
                    >
                      {availableMonths.length === 0 && <option value="">Entire Program (Start/End dates not set)</option>}
                      {availableMonths.length > 0 && <option value="">Flat Target (All Months)</option>}
                      {availableMonths.map(m => (
                        <option key={m} value={m}>{new Date(`${m}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
                      ))}
                    </select>

                    {/* Branch Slicer */}
                    {availableBranches.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', alignItems: 'center' }}>
                        <button 
                          className="btn"
                          onClick={() => setIndividualTargetsBranches([])}
                          style={{ 
                            borderRadius: '20px', padding: '4px 14px', fontSize: '12px', whiteSpace: 'nowrap',
                            background: individualTargetsBranches.length === 0 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                            border: individualTargetsBranches.length === 0 ? 'none' : '1px solid var(--border)',
                            color: individualTargetsBranches.length === 0 ? 'white' : 'var(--text-muted)'
                          }}
                        >
                          All
                        </button>
                        {availableBranches.map(b => (
                          <button 
                            key={b}
                            className="btn"
                            onClick={() => {
                              if (individualTargetsBranches.includes(b)) {
                                setIndividualTargetsBranches(individualTargetsBranches.filter(x => x !== b));
                              } else {
                                setIndividualTargetsBranches([...individualTargetsBranches, b]);
                              }
                            }}
                            style={{ 
                              borderRadius: '20px', padding: '4px 14px', fontSize: '12px', whiteSpace: 'nowrap',
                              background: individualTargetsBranches.includes(b) ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                              border: individualTargetsBranches.includes(b) ? 'none' : '1px solid var(--border)',
                              color: individualTargetsBranches.includes(b) ? 'white' : 'var(--text-muted)'
                            }}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <button 
                        className="btn" 
                        onClick={() => handleUpdateTrackingGroup(group.id, { individualTargets: {} })}
                        style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none', padding: '6px 12px', fontSize: '12px', borderRadius: '4px' }}
                      >
                        Clear All Targets
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px' }}>
                    {filteredParticipating.map(salesmanId => {
                      const salesmanInfo = salesmen.find(s => s.id === salesmanId);
                      const name = salesmanInfo ? salesmanInfo.name : salesmanId;
                      const branch = salesmanInfo ? salesmanInfo.branch : '';
                      
                      let currentTarget = '';
                      const data = targets[salesmanId];
                      if (individualTargetsMonth) {
                        if (typeof data === 'object' && data !== null) {
                          currentTarget = data[individualTargetsMonth] !== undefined ? String(data[individualTargetsMonth]) : '';
                        }
                      } else {
                        if (typeof data === 'number') {
                          currentTarget = String(data);
                        } else if (typeof data === 'object' && data !== null && data['flat']) {
                           currentTarget = String(data['flat']);
                        }
                      }

                      return (
                        <div key={salesmanId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500, color: 'white' }}>{name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {salesmanId}{branch && branch !== 'Unassigned' ? ` • ${branch}` : ''}</span>
                          </div>
                          <div style={{ width: '150px' }}>
                            <input 
                              type="number" 
                              placeholder={individualTargetsMonth ? `${new Date(`${individualTargetsMonth}-01`).toLocaleString('default', {month:'short'})} Target` : `Target ${group.targetType === 'STT' ? '(₱)' : ''}`}
                              value={currentTarget}
                              onChange={e => {
                                const val = e.target.value;
                                const newTargets = { ...targets } as Record<string, any>;
                                
                                if (individualTargetsMonth) {
                                  const currentData = newTargets[salesmanId];
                                  const isObj = typeof currentData === 'object' && currentData !== null;
                                  const monthData = isObj ? { ...currentData } : {};
                                  
                                  if (val === '') {
                                    delete monthData[individualTargetsMonth];
                                    if (Object.keys(monthData).length === 0) {
                                      delete newTargets[salesmanId];
                                    } else {
                                      newTargets[salesmanId] = monthData;
                                    }
                                  } else {
                                    monthData[individualTargetsMonth] = Number(val);
                                    newTargets[salesmanId] = monthData;
                                  }
                                } else {
                                  if (val === '') {
                                    delete newTargets[salesmanId];
                                  } else {
                                    newTargets[salesmanId] = Number(val);
                                  }
                                }
                                
                                handleUpdateTrackingGroup(group.id, { individualTargets: newTargets });
                              }}
                              style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => { setIndividualTargetsModal(null); setIndividualTargetsSearch(''); }}
                      style={{ padding: '12px 40px', borderRadius: '30px', boxShadow: '0 8px 16px rgba(59,130,246,0.3)', width: '200px' }}
                    >
                      Save Targets
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default IncentiveProgramMaker;
