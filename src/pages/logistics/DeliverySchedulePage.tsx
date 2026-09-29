import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Trash2, Save, Search, MapPin, Download, FileSpreadsheet, Eye, Edit3 } from 'lucide-react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { DeliverySchedule, LogisticsManning } from '../../types/logistics';
import { saveDraft } from '../../utils/indexedDB';
import * as XLSX from 'xlsx-js-style';

const DeliverySchedulePage: React.FC = () => {
  const { role } = useAuth();
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [loading, setLoading] = useState(true);
  
  const canEdit = role === 'admin' || role === 'warehouse_supervisor';
  const [viewMode, setViewMode] = useState<'edit' | 'read'>(canEdit ? 'edit' : 'read');

  const [editingRecord, setEditingRecord] = useState<DeliverySchedule | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Right side filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPlate, setFormPlate] = useState('');
  const [formPicklists, setFormPicklists] = useState<string[]>(['']);
  const [formRoute, setFormRoute] = useState('');
  const [formAccounts, setFormAccounts] = useState(0);
  const [formQtyCS, setFormQtyCS] = useState(0);
  const [formSalesmen, setFormSalesmen] = useState('');
  const [formHelpers, setFormHelpers] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  // Real-time listeners
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'logistics_schedules'), (snap) => {
        const data: DeliverySchedule[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as DeliverySchedule));
        data.sort((a, b) => b.date.localeCompare(a.date) || a.plateNumber.localeCompare(b.plateNumber));
        setSchedules(data);
        setLoading(false);
      }),
      onSnapshot(collection(db, 'logistics_manning'), (snap) => {
        const data: LogisticsManning[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as LogisticsManning));
        setManningRecords(data);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filteredSchedules = useMemo(() => {
    let filtered = schedules;
    if (filterDate) {
      filtered = filtered.filter((s) => s.date === filterDate);
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

  const handleCreateNew = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPlate('');
    setFormPicklists(['']);
    setFormRoute('');
    setFormAccounts(0);
    setFormQtyCS(0);
    setFormSalesmen('');
    setFormHelpers('');
    setFormRemarks('');
  };

  const handleSelectForEdit = (record: DeliverySchedule) => {
    setEditingRecord(record);
    setFormDate(record.date);
    setFormPlate(record.plateNumber);
    setFormPicklists(record.picklistNumbers.length > 0 ? [...record.picklistNumbers] : ['']);
    setFormRoute(record.route);
    setFormAccounts(record.noOfAccounts);
    setFormQtyCS(record.qtyCS);
    setFormSalesmen(record.salesmen.join(', '));
    setFormHelpers(record.helpers.join(', '));
    setFormRemarks(record.remarks || '');
  };

  const handleSaveToDraft = async () => {
    if (!formDate || !formPlate || !formRoute) return;
    setSaving(true);
    try {
      const cleanPicklists = formPicklists.filter((p) => p.trim() !== '');
      const docId = editingRecord?.id || `${formDate}_${formPlate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      const payload = {
        id: docId,
        date: formDate,
        plateNumber: formPlate,
        picklistNumbers: cleanPicklists,
        route: formRoute.trim(),
        noOfAccounts: formAccounts,
        qtyCS: formQtyCS,
        salesmen: formSalesmen.split(',').map((s) => s.trim()).filter(Boolean),
        helpers: formHelpers.split(',').map((h) => h.trim()).filter(Boolean),
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
      setFormHelpers(manning.helpers.join(', '));
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
        /* 80/20 Layout Grid */
        <div style={{ display: 'grid', gridTemplateColumns: '8fr 2fr', gap: '24px', flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN: 80% Form */}
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
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Date *</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ width: '100%' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Plate Number *</label>
                <select value={formPlate} onChange={(e) => handlePlateSelect(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select plate...</option>
                  {manningRecords.map((m) => (
                    <option key={m.id} value={m.plateNumber}>{m.plateNumber} ({m.vehicleType})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Route / City *</label>
                <input type="text" placeholder="e.g. Quezon City" value={formRoute} onChange={(e) => setFormRoute(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>No. of Accounts</label>
                  <input type="number" min={0} value={formAccounts} onChange={(e) => setFormAccounts(parseInt(e.target.value) || 0)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Qty (CS)</label>
                  <input type="number" min={0} value={formQtyCS} onChange={(e) => setFormQtyCS(parseInt(e.target.value) || 0)} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Picklist Numbers (Comma-separated)</label>
                  <button
                    onClick={() => setFormPicklists((p) => [...p, ''])}
                    className="btn"
                    style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: 'none' }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formPicklists.map((pl, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder={`Picklist ${i + 1}`}
                        value={pl}
                        onChange={(e) => setFormPicklists((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                        style={{ flex: 1 }}
                      />
                      {formPicklists.length > 1 && (
                        <button onClick={() => setFormPicklists((p) => p.filter((_, j) => j !== i))} className="btn-icon" style={{ flexShrink: 0 }}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Salesmen (comma-separated)</label>
                  <input type="text" placeholder="SM001, SM002" value={formSalesmen} onChange={(e) => setFormSalesmen(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Helpers (comma-separated)</label>
                  <input type="text" placeholder="Helper 1, Helper 2" value={formHelpers} onChange={(e) => setFormHelpers(e.target.value)} style={{ width: '100%' }} />
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
                      <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🚚 {record.plateNumber}
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
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Team (Sales/Helpers)</th>
                    <th style={{ padding: '16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map(sched => (
                    <tr key={sched.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px', fontWeight: 600, color: 'var(--text-main)' }}>🚚 {sched.plateNumber}</td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>{sched.route}</td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>{sched.noOfAccounts} Acc / {sched.qtyCS} CS</td>
                      <td style={{ padding: '16px', color: 'var(--accent-primary)', fontSize: '13px', wordBreak: 'break-all' }}>{sched.picklistNumbers.join(', ')}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)' }}>SM:</span> {sched.salesmen.join(', ')}</div>
                        <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)' }}>HL:</span> {sched.helpers.join(', ')}</div>
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
    </div>
  );
};

export default DeliverySchedulePage;
