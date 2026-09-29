import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Trash2, Save, X, Search, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { LogisticsManning } from '../../types/logistics';
import { VEHICLE_TYPES } from '../../types/logistics';
import { saveDraft } from '../../utils/indexedDB';

const EMPTY_MANNING: Omit<LogisticsManning, 'id' | 'createdAt' | 'updatedAt'> = {
  plateNumber: '',
  driverName: '',
  helpers: [''],
  vehicleType: 'Elf',
};

const ManningPage: React.FC = () => {
  const { role } = useAuth();
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingRecord, setEditingRecord] = useState<LogisticsManning | null>(null);
  const [formData, setFormData] = useState(EMPTY_MANNING);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const canEdit = role === 'admin' || role === 'warehouse_supervisor';

  // Real-time listener for manning records
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'logistics_manning'), (snap) => {
      const records: LogisticsManning[] = [];
      snap.forEach((d) => {
        records.push({ id: d.id, ...d.data() } as LogisticsManning);
      });
      records.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber));
      setManningRecords(records);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return manningRecords;
    const q = searchQuery.toLowerCase();
    return manningRecords.filter(
      (r) =>
        r.plateNumber.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.helpers.some((h) => h.toLowerCase().includes(q)) ||
        r.vehicleType.toLowerCase().includes(q)
    );
  }, [manningRecords, searchQuery]);

  const handleCreateNew = () => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_MANNING, helpers: [''] });
  };

  const handleSelectForEdit = (record: LogisticsManning) => {
    setEditingRecord(record);
    setFormData({
      plateNumber: record.plateNumber,
      driverName: record.driverName,
      helpers: record.helpers.length > 0 ? [...record.helpers] : [''],
      vehicleType: record.vehicleType,
    });
  };

  const handleAddHelper = () => {
    setFormData((prev) => ({ ...prev, helpers: [...prev.helpers, ''] }));
  };

  const handleRemoveHelper = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      helpers: prev.helpers.filter((_, i) => i !== index),
    }));
  };

  const handleHelperChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      helpers: prev.helpers.map((h, i) => (i === index ? value : h)),
    }));
  };

  const handleSaveToDraft = async () => {
    if (!formData.plateNumber.trim() || !formData.driverName.trim()) return;
    setSaving(true);
    try {
      const cleanHelpers = formData.helpers.filter((h) => h.trim() !== '');
      const docId = editingRecord?.id || formData.plateNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const payload = {
        id: docId,
        plateNumber: formData.plateNumber.trim(),
        driverName: formData.driverName.trim(),
        helpers: cleanHelpers,
        vehicleType: formData.vehicleType,
        createdAt: editingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveDraft('manning', payload);
      alert('Saved to local drafts! Sync via the pending cloud button.');
      handleCreateNew();
    } catch (err: any) {
      console.error('Error saving manning record to draft:', err);
      alert('Failed to save draft: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_manning', id));
      setDeleteConfirm(null);
      if (editingRecord?.id === id) {
        handleCreateNew();
      }
    } catch (err: any) {
      console.error('Error deleting manning record:', err);
      alert('Failed to delete: ' + err.message);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'Tractor': return '🚛';
      case '10WH': return '🚚';
      case 'Forward': return '🚚';
      case '6WH': return '🚐';
      case 'Elf': return '🚐';
      default: return '🚗';
    }
  };

  if (!canEdit) {
    return (
      <div className="animate-fade-in glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--accent-warning)" style={{ margin: '0 auto 16px' }} />
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--text-muted)' }}>Only Warehouse Supervisors and Admins can view and edit Logistics Manning.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={24} style={{ color: 'var(--accent-primary)' }} />
            Logistics Manning
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage vehicle teams, drivers, and helpers
          </p>
        </div>
      </div>

      {/* 80/20 Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '8fr 2fr', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: 80% Form */}
        <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>{editingRecord ? 'Edit Delivery Team' : 'Create New Delivery Team'}</h3>
            {editingRecord && (
              <button onClick={handleCreateNew} className="btn" style={{ fontSize: '13px' }}>
                <Plus size={14} /> New Entry
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Plate Number */}
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Plate Number (Login Account) *</label>
              <input
                id="manning-plate-number"
                type="text"
                placeholder="e.g. ABC-1234"
                value={formData.plateNumber}
                onChange={(e) => setFormData((p) => ({ ...p, plateNumber: e.target.value.toUpperCase() }))}
                disabled={!!editingRecord}
                style={{ width: '100%', ...(editingRecord ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
              />
              {!editingRecord && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  A user account should be created for this plate (e.g. {formData.plateNumber ? `${formData.plateNumber}@KENEA.com` : 'PLATE@KENEA.com'}) by the Admin.
                </p>
              )}
            </div>

            {/* Vehicle Type */}
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Vehicle Type *</label>
              <select
                id="manning-vehicle-type"
                value={formData.vehicleType}
                onChange={(e) => setFormData((p) => ({ ...p, vehicleType: e.target.value as any }))}
                style={{ width: '100%' }}
              >
                {VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>{getVehicleIcon(vt)} {vt}</option>
                ))}
              </select>
            </div>

            {/* Driver Name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Delivery Driver *</label>
              <input
                id="manning-driver-name"
                type="text"
                placeholder="Full name of driver"
                value={formData.driverName}
                onChange={(e) => setFormData((p) => ({ ...p, driverName: e.target.value }))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Helpers */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>List of Helpers</label>
                <button onClick={handleAddHelper} className="btn" style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: 'none' }}>
                  <Plus size={12} /> Add Helper
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {formData.helpers.map((helper, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder={`Helper ${i + 1}`}
                      value={helper}
                      onChange={(e) => handleHelperChange(i, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {formData.helpers.length > 1 && (
                      <button onClick={() => handleRemoveHelper(i)} className="btn-icon" style={{ flexShrink: 0 }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveToDraft}
              className="btn btn-primary"
              disabled={saving || !formData.plateNumber.trim() || !formData.driverName.trim()}
              id="save-manning-btn"
              style={{ padding: '12px 24px', fontSize: '14px' }}
            >
              {saving ? (
                <><span className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block' }} /> Saving...</>
              ) : (
                <><Save size={18} /> {editingRecord ? 'Update & Save to Draft' : 'Save to Draft'}</>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 20% Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="manning-search"
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%', fontSize: '13px', padding: '8px 8px 8px 36px' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No records found</div>
            ) : (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className={`glass-panel ${editingRecord?.id === record.id ? 'active' : ''}`}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    position: 'relative',
                    border: editingRecord?.id === record.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  }}
                  onClick={() => handleSelectForEdit(record)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getVehicleIcon(record.vehicleType)} {record.plateNumber}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {record.plateNumber}@KENEA.com
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(record.id); }}
                      className="btn-icon"
                      style={{ width: '24px', height: '24px' }}
                    >
                      <Trash2 size={12} color="var(--accent-danger)" />
                    </button>
                  </div>
                  
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Driver:</span> {record.driverName}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Helpers:</span> 
                    {record.helpers.length > 0 ? (
                       <span style={{ color: 'var(--accent-success)' }}>{record.helpers.length} assigned</span>
                    ) : (
                       <span style={{ fontStyle: 'italic', opacity: 0.5 }}>None</span>
                    )}
                  </div>

                  {deleteConfirm === record.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)',
                      backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px',
                      zIndex: 5, animation: 'fadeIn 0.2s ease-out',
                    }}>
                      <p style={{ fontSize: '12px', textAlign: 'center', margin: 0 }}>Delete?</p>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="btn" style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }} className="btn" style={{ background: 'var(--accent-danger)', color: 'white', fontSize: '11px', padding: '4px 8px' }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManningPage;
