import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Trash2, Save, Search, MapPin, Download, FileSpreadsheet, Eye, Edit3, X, ListChecks, Check } from 'lucide-react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import type { DeliverySchedule, LogisticsManning, Picklist } from '../../types/logistics';
import { saveDraft } from '../../utils/indexedDB';
import { Modal } from '../../components/ui/Modal';
import * as XLSX from 'xlsx-js-style';

const DeliverySchedulePage: React.FC = () => {
  const { role } = useAuth();
  const { canEditPage } = useUI();
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [availablePicklists, setAvailablePicklists] = useState<Picklist[]>([]);
  const [loading, setLoading] = useState(true);
  
  const canEdit = canEditPage('logistics_schedule', role!);
  const [viewMode, setViewMode] = useState<'edit' | 'read'>(canEdit ? 'edit' : 'read');

  const [editingRecord, setEditingRecord] = useState<DeliverySchedule | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Picklist Modal State
  const [isPicklistModalOpen, setIsPicklistModalOpen] = useState(false);
  const [picklistSearchQuery, setPicklistSearchQuery] = useState('');
  
  // Right side filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPlate, setFormPlate] = useState('');
  const [formPicklists, setFormPicklists] = useState<string[]>([]);
  const [formRoute, setFormRoute] = useState('');
  const [formAccounts, setFormAccounts] = useState(0);
  const [formQtyCS, setFormQtyCS] = useState(0);
  const [formSalesmen, setFormSalesmen] = useState('');
  const [formDriverName, setFormDriverName] = useState('');
  const [formHelpers, setFormHelpers] = useState('');
  const [formNoOfPushcart, setFormNoOfPushcart] = useState(0);
  const [formRemarks, setFormRemarks] = useState('');

  // Real-time listeners
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'logistics_schedules'), (snap) => {
        const data: DeliverySchedule[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as DeliverySchedule));
        data.sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date) || a.plateNumber.localeCompare(b.plateNumber));
        setSchedules(data);
        setLoading(false);
      }),
      onSnapshot(collection(db, 'logistics_manning'), (snap) => {
        const data: LogisticsManning[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as LogisticsManning));
        setManningRecords(data);
      }),
      onSnapshot(collection(db, 'logistics_picklists'), (snap) => {
        const data: Picklist[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as Picklist));
        setAvailablePicklists(data);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    if (filterDate) {
      filtered = filtered.filter((s) => (s.createdAt?.split('T')[0] || s.date) === filterDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.plateNumber.toLowerCase().includes(q) ||
          s.route.toLowerCase().includes(q) ||
          s.salesmen.some((sm) => sm.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [schedules, filterDate, searchQuery]);

  const filteredAvailablePicklists = useMemo(() => {
    if (!picklistSearchQuery.trim()) return availablePicklists;
    const q = picklistSearchQuery.toLowerCase();
    return availablePicklists.filter(
      (p) =>
        p.picklistNumber.toLowerCase().includes(q) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.salesmanName && p.salesmanName.toLowerCase().includes(q)) ||
        (p.salesmanCode && p.salesmanCode.toLowerCase().includes(q))
    );
  }, [availablePicklists, picklistSearchQuery]);

  const updatePicklistsAndRecalculate = (selectedNumbers: string[]) => {
    setFormPicklists(selectedNumbers);

    const selectedItems = availablePicklists.filter((p) => selectedNumbers.includes(p.picklistNumber));
    if (selectedItems.length > 0) {
      const cities = Array.from(new Set(selectedItems.map((p) => p.city).filter(Boolean))).join(', ');
      setFormRoute(cities);

      const totalAccounts = selectedItems.reduce((sum, p) => sum + (p.numberOfAccounts || 0), 0);
      setFormAccounts(totalAccounts);

      const totalCS = selectedItems.reduce((sum, p) => sum + (p.cs || 0), 0);
      setFormQtyCS(totalCS);

      const salesmen = Array.from(
        new Set(selectedItems.map((p) => p.salesmanName || p.salesmanCode).filter(Boolean))
      ).join(', ');
      setFormSalesmen(salesmen);
    } else if (selectedNumbers.length === 0) {
      setFormRoute('');
      setFormAccounts(0);
      setFormQtyCS(0);
      setFormSalesmen('');
    }
  };

  const togglePicklistSelection = (plNumber: string) => {
    const current = formPicklists.filter(Boolean);
    const updated = current.includes(plNumber)
      ? current.filter((x) => x !== plNumber)
      : [...current, plNumber];
    updatePicklistsAndRecalculate(updated);
  };

  const handleCreateNew = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPlate('');
    setFormPicklists([]);
    setFormRoute('');
    setFormAccounts(0);
    setFormQtyCS(0);
    setFormSalesmen('');
    setFormDriverName('');
    setFormHelpers('');
    setFormNoOfPushcart(0);
    setFormRemarks('');
  };

  const handleSelectForEdit = (record: DeliverySchedule) => {
    setEditingRecord(record);
    setFormDate(record.date);
    setFormPlate(record.plateNumber);
    setFormPicklists(record.picklistNumbers.length > 0 ? [...record.picklistNumbers] : []);
    setFormRoute(record.route);
    setFormAccounts(record.noOfAccounts);
    setFormQtyCS(record.qtyCS);
    setFormSalesmen(record.salesmen.join(', '));
    setFormDriverName(record.driverName || '');
    setFormHelpers(record.helpers.join(', '));
    setFormNoOfPushcart(record.noOfPushcart || 0);
    setFormRemarks(record.remarks || '');
  };

  const handleSaveToDraft = async () => {
    if (!formDate || !formPlate || !formRoute) return;
    setSaving(true);
    try {
      const cleanPicklists = formPicklists.filter((p) => p.trim() !== '');
      const docId = editingRecord?.id || `${formDate}_${formPlate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const payload: DeliverySchedule = {
        id: docId,
        date: formDate,
        plateNumber: formPlate,
        picklistNumbers: cleanPicklists,
        route: formRoute.trim(),
        noOfAccounts: formAccounts,
        qtyCS: formQtyCS,
        salesmen: formSalesmen.split(',').map((s) => s.trim()).filter(Boolean),
        driverName: formDriverName.trim(),
        helpers: formHelpers.split(',').map((h) => h.trim()).filter(Boolean),
        noOfPushcart: formNoOfPushcart,
        remarks: formRemarks.trim(),
        status: editingRecord?.status || 'Scheduled',
        createdBy: editingRecord?.createdBy || role || 'unknown',
        createdAt: editingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveDraft('schedule', payload);
      alert('Saved to local drafts! Sync via the pending cloud button.');
      handleCreateNew();
    } catch (err: any) {
      console.error('Error saving schedule to draft:', err);
      alert('Failed to save draft: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_schedules', id));
      setDeleteConfirm(null);
      if (editingRecord?.id === id) {
        handleCreateNew();
      }
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handlePlateSelect = (plate: string) => {
    setFormPlate(plate);
    const manning = manningRecords.find((m) => m.plateNumber === plate);
    if (manning) {
      setFormDriverName(manning.driverName || '');
      setFormHelpers(manning.helpers.join(', '));
    } else {
      setFormDriverName('');
      setFormHelpers('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'In Transit': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      default: return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  // --- Exports ---
  const exportRawExcel = () => {
    if (filteredSchedules.length === 0) return alert('No data to export.');
    const ws = XLSX.utils.json_to_sheet(filteredSchedules.map(s => ({
      Date: s.date,
      'Plate Number': s.plateNumber,
      Route: s.route,
      'No Of Accounts': s.noOfAccounts,
      'Qty CS': s.qtyCS,
      'Picklist Nos': s.picklistNumbers.join(', '),
      Salesmen: s.salesmen.join(', '),
      Driver: s.driverName || '',
      Helpers: s.helpers.join(', '),
      Remarks: s.remarks,
      Status: s.status,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raw Data');
    XLSX.writeFile(wb, `Delivery_Schedules_Raw_${filterDate}.xlsx`);
  };

  const exportFormattedExcel = () => {
    if (filteredSchedules.length === 0) return alert('No data to export.');
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];
    
    // Header
    wsData.push(['DELIVERY DISPATCH SCHEDULE']);
    wsData.push(['Date:', filterDate]);
    wsData.push([]);
    wsData.push(['Plate Number', 'Route / City', 'Accounts', 'CS Qty', 'Picklists', 'Salesmen', 'Helpers', 'Status', 'Remarks']);
    
    filteredSchedules.forEach(s => {
      wsData.push([
        s.plateNumber, s.route, s.noOfAccounts, s.qtyCS, 
        s.picklistNumbers.join(', '), s.salesmen.join(', '), 
        s.helpers.join(', '), s.status, s.remarks || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styles to title
    ws['A1'] = { v: 'DELIVERY DISPATCH SCHEDULE', t: 's', s: { font: { bold: true, sz: 16 } } };
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }]; // Merge title across columns

    // Apply styles to table headers
    for (let c = 0; c <= 8; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "EFEFEF" } },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
      }
    }

    // Print setup
    ws['!pageSetup'] = { paperSize: 14, orientation: 'landscape', fitToWidth: 1 };
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Print Format');
    XLSX.writeFile(wb, `Delivery_Schedules_Print_${filterDate}.xlsx`);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={24} style={{ color: 'var(--accent-primary)' }} />
            Delivery Schedule
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Plan and track daily delivery dispatches
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {role === 'admin' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportRawExcel} className="btn" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
                <FileSpreadsheet size={16} /> Raw Export
              </button>
              <button onClick={exportFormattedExcel} className="btn" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
                <Download size={16} /> Print Export
              </button>
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setViewMode('read')} 
                className="btn" 
                style={{ background: viewMode === 'read' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'read' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 12px' }}
              >
                <Eye size={16} /> Read
              </button>
              <button 
                onClick={() => setViewMode('edit')} 
                className="btn" 
                style={{ background: viewMode === 'edit' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'edit' ? 'white' : 'var(--text-muted)', border: 'none', padding: '6px 12px' }}
              >
                <Edit3 size={16} /> Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'edit' ? (
        /* 60/40 Layout Grid */
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '24px', flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN: 60% Form */}
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingRecord ? 'Edit Schedule' : 'Create New Schedule'}</h3>
              {editingRecord && (
                <button onClick={handleCreateNew} className="btn" style={{ fontSize: '13px' }}>
                  <Plus size={14} /> New Entry
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Delivery Date *</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ width: '100%' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Plate Number * (Editable)</label>
                <select value={formPlate} onChange={(e) => handlePlateSelect(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select plate...</option>
                  {manningRecords.map((m) => (
                    <option key={m.id} value={m.plateNumber}>{m.plateNumber} ({m.vehicleType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span>Route / City *</span>
                  <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                </label>
                <input
                  type="text"
                  placeholder="Auto-filled from selected picklists"
                  value={formRoute}
                  readOnly
                  style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>No. of Accounts</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                  </label>
                  <input
                    type="number"
                    value={formAccounts}
                    readOnly
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Qty (CS)</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                  </label>
                  <input
                    type="number"
                    value={formQtyCS}
                    readOnly
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              {/* Editable Field #2: Picklist Selector */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Picklist Numbers * (Editable Selector)
                  </label>
                  {formPicklists.length > 0 && (
                    <span className="badge" style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      {formPicklists.length} Selected
                    </span>
                  )}
                </div>

                {formPicklists.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {formPicklists.map((pl) => (
                      <span
                        key={pl}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--accent-primary)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          fontSize: '13px',
                          fontWeight: 600,
                        }}
                      >
                        📋 {pl}
                        <X
                          size={14}
                          style={{ cursor: 'pointer', opacity: 0.8 }}
                          onClick={() => togglePicklistSelection(pl)}
                        />
                      </span>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsPicklistModalOpen(true)}
                  className="btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px dashed var(--accent-primary)',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    fontSize: '13px',
                  }}
                >
                  <ListChecks size={18} /> {formPicklists.length > 0 ? 'Modify Picklist Selection...' : 'Click to Select Picklists...'}
                </button>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Salesmen</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-filled from selected picklists"
                    value={formSalesmen}
                    readOnly
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Driver Name</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-filled from Plate Manning"
                    value={formDriverName}
                    readOnly
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Helpers</span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-primary)', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Auto</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Auto-filled from Plate Manning"
                    value={formHelpers}
                    readOnly
                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.4)', color: 'var(--text-muted)', cursor: 'not-allowed', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>No. of Pushcart</label>
                  <input
                    type="number"
                    min={0}
                    value={formNoOfPushcart}
                    onChange={(e) => setFormNoOfPushcart(parseInt(e.target.value) || 0)}
                    placeholder="Enter number of pushcarts"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Remarks</label>
                <textarea value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} rows={2} placeholder="Optional notes..." style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveToDraft}
                className="btn btn-primary"
                disabled={saving || !formDate || !formPlate || !formRoute.trim()}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              />
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search schedule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', width: '100%', fontSize: '13px', padding: '8px 8px 8px 36px' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : filteredSchedules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No records found</div>
              ) : (
                filteredSchedules.slice(0, 10).map((record) => (
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
                        <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          🚚 {record.plateNumber}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Created: {record.createdAt?.split('T')[0] || record.date} <br />
                          Delivery: {record.date}
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
                    
                    <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} style={{ color: 'var(--accent-success)' }} /> {record.route}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {record.noOfAccounts} Acc | {record.qtyCS} CS
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
              {filteredSchedules.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Showing latest 10 records. Use search to find more.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* READ VIEW: Centered Formatted Tabular Sheet */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          
          <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: '200px' }} />
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: '36px', width: '100%' }} />
            </div>
          </div>

          <div className="glass-panel" style={{ width: '100%', maxWidth: '1200px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '16px', padding: 0 }}>
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1, borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Plate</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Route/City</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Acc/CS</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Picklists</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Team (Sales/Driver/Helpers)</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map(sched => (
                    <tr key={sched.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>🚚 {sched.plateNumber}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Created: {sched.createdAt?.split('T')[0] || sched.date} <br />
                          Delivery: {sched.date}
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>{sched.route}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>{sched.noOfAccounts} Acc / {sched.qtyCS} CS</td>
                      <td style={{ padding: '16px', color: 'var(--accent-primary)', fontSize: '13px', wordBreak: 'break-all' }}>{sched.picklistNumbers.join(', ')}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)' }}>SM:</span> {sched.salesmen.join(', ') || 'N/A'}</div>
                        <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)' }}>DR:</span> {sched.driverName || 'N/A'}</div>
                        <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)' }}>HL:</span> {sched.helpers.join(', ') || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: getStatusColor(sched.status).bg, color: getStatusColor(sched.status).color
                        }}>
                          {sched.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        No schedule data found for this date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Picklist Selection Modal */}
      <Modal
        isOpen={isPicklistModalOpen}
        onClose={() => setIsPicklistModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ListChecks size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Select Picklists</span>
          </div>
        }
        maxWidth="650px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search picklist #, city, or salesman..."
              value={picklistSearchQuery}
              onChange={(e) => setPicklistSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span>Showing {filteredAvailablePicklists.length} picklists</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const allFiltered = Array.from(new Set([...formPicklists, ...filteredAvailablePicklists.map((p) => p.picklistNumber)]));
                  updatePicklistsAndRecalculate(allFiltered);
                }}
                className="btn"
                style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }}
              >
                Select All Filtered
              </button>
              <button
                type="button"
                onClick={() => updatePicklistsAndRecalculate([])}
                className="btn"
                style={{ padding: '2px 8px', fontSize: '11px', background: 'transparent', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {filteredAvailablePicklists.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                {availablePicklists.length === 0
                  ? 'No picklists available in system. Upload or create picklist data first.'
                  : 'No picklists match your search.'}
              </div>
            ) : (
              filteredAvailablePicklists.map((pl) => {
                const isSelected = formPicklists.includes(pl.picklistNumber);
                return (
                  <div
                    key={pl.id}
                    onClick={() => togglePicklistSelection(pl.picklistNumber)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-panel)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: isSelected ? 'none' : '1px solid var(--border)',
                          background: isSelected ? 'var(--accent-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                        }}
                      >
                        {isSelected && <Check size={14} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📋 {pl.picklistNumber}
                          {pl.city && (
                            <span className="badge" style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'none', padding: '2px 6px' }}>
                              {pl.city}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Salesman: {pl.salesmanName || pl.salesmanCode || 'N/A'} • Date: {pl.picklistDate || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {pl.numberOfAccounts || 0} Acc | {pl.cs || 0} CS
                      </div>
                      {pl.systemStatus && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {pl.systemStatus}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsPicklistModalOpen(false)}
              className="btn btn-primary"
              style={{ padding: '8px 24px', fontSize: '13px' }}
            >
              Done ({formPicklists.length} Selected)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeliverySchedulePage;
