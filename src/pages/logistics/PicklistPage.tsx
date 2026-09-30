import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Trash2, Save, Search, Eye, Edit3, User, FileSpreadsheet, MapPin, Briefcase } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import type { Picklist } from '../../types/logistics';
import { saveDraft } from '../../utils/indexedDB';
import * as XLSX from 'xlsx-js-style';
import { Modal } from '../../components/ui/Modal';

const PicklistPage: React.FC = () => {
  const { role, currentUser, name } = useAuth();
  const { canEditPage } = useUI();
  const [picklists, setPicklists] = useState<Picklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<Picklist | null>(null);
  const [saving, setSaving] = useState(false);
  
  const canEdit = canEditPage('logistics_picklist', role!);
  const canCreate = canEdit;
  const canEditStatus = role === 'admin' || role === 'warehouse_supervisor';
  const canDelete = role === 'admin';
  const [viewMode, setViewMode] = useState<'edit' | 'read'>(canCreate ? 'edit' : 'read');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterSalesman, setFilterSalesman] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Modals
  const [showSalesmanModal, setShowSalesmanModal] = useState<'form' | 'filter' | null>(null);
  const [showCityModal, setShowCityModal] = useState<'form' | 'filter' | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [salesmenList, setSalesmenList] = useState<{code: string, name: string}[]>([]);
  const [selectedModalCities, setSelectedModalCities] = useState<string[]>([]);

  // Read View State
  const [selectedSalesmanForRead, setSelectedSalesmanForRead] = useState<string | null>(null);
  const [selectedPicklistForRead, setSelectedPicklistForRead] = useState<Picklist | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNumber, setFormNumber] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formSalesmanCode, setFormSalesmanCode] = useState('');
  const [formSalesmanName, setFormSalesmanName] = useState('');
  const [formCS, setFormCS] = useState(0);
  const [formSC, setFormSC] = useState(0);
  const [formPC, setFormPC] = useState(0);
  const [formAmount, setFormAmount] = useState(0);
  const [formAccounts, setFormAccounts] = useState(0);
  const [formChecker, setFormChecker] = useState('');
  const [formCustomers, setFormCustomers] = useState<any[]>([]);
  const [pasteText, setPasteText] = useState('');
  
  const [currentSalesmanCustomers, setCurrentSalesmanCustomers] = useState<any[]>([]);
  const [readModeCmlMap, setReadModeCmlMap] = useState<Record<string, any>>({});

  // Real-time listener for Picklists
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'logistics_picklists'), (snap) => {
      const data: Picklist[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as Picklist));
      data.sort((a, b) => b.picklistDate.localeCompare(a.picklistDate) || a.picklistNumber.localeCompare(b.picklistNumber));
      setPicklists(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch Salesmen
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const sms: {code: string, name: string}[] = [];
      snap.forEach(d => {
        const u = d.data();
        if (u.role === 'salesman' && u.salesmanType === 'Booking') {
          sms.push({ code: u.salesmanId || '-', name: u.name || '-' });
        }
      });
      setSalesmenList(sms);
    });
    return () => unsub();
  }, []);

  // Derived Cities from reference_geo with caching
  const [allCities, setAllCities] = useState<string[]>([]);

  useEffect(() => {
    const fetchGeoCities = async () => {
      const CACHE_KEY = 'geo_cities_cache';
      const CACHE_TIME_KEY = 'geo_cities_timestamp';
      const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

      try {
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedCities = localStorage.getItem(CACHE_KEY);
        
        // Use cache if it's fresh (less than 24 hours old)
        if (cachedTime && cachedCities) {
          const isExpired = (Date.now() - parseInt(cachedTime, 10)) > CACHE_DURATION;
          if (!isExpired) {
            setAllCities(JSON.parse(cachedCities));
            return;
          }
        }

        // Fetch exactly once (getDocs) instead of listening to real-time changes
        const geoSnap = await getDocs(collection(db, 'reference_geo'));
        const citySet = new Set<string>();
        
        geoSnap.forEach(d => {
          const data = d.data();
          if (data.City) citySet.add(data.City);
        });
        
        const cityList = Array.from(citySet).sort();
        setAllCities(cityList);
        
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(cityList));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      } catch (err) {
        console.error('Failed to fetch reference_geo:', err);
      }
    };

    fetchGeoCities();
  }, []);

  useEffect(() => {
    if (formCustomers.length > 0) {
      setFormAccounts(formCustomers.length);
    }
  }, [formCustomers]);

  // Fetch CML when salesman changes in Edit Mode
  useEffect(() => {
    if (!formSalesmanCode) {
      setCurrentSalesmanCustomers([]);
      return;
    }
    const safeId = formSalesmanCode.replace(/[^a-zA-Z0-9_]/g, '');
    getDoc(doc(db, 'customer_data', safeId)).then(snap => {
      if (snap.exists()) {
        try {
          const arr = JSON.parse(snap.data().customers || '[]');
          setCurrentSalesmanCustomers(arr);
        } catch(e) {
          setCurrentSalesmanCustomers([]);
        }
      } else {
        setCurrentSalesmanCustomers([]);
      }
    });
  }, [formSalesmanCode]);

  // Auto-map missing customer details when CML data loads or formCustomers changes
  useEffect(() => {
    if (currentSalesmanCustomers.length === 0 || formCustomers.length === 0) return;
    
    let updated = false;
    const remapped = formCustomers.map(c => {
      if (!c.barangay && !c.city) {
        const cmlData = currentSalesmanCustomers.find(cml => 
          String(cml['CUSTOMER CODE'] || cml['CUSTOMER NUMBER'] || cml['CUSTOMER ID'] || '').toUpperCase() === c.code.toUpperCase()
        );
        if (cmlData) {
          updated = true;
          return {
            ...c,
            barangay: String(cmlData['BARANGAY'] || cmlData['BRGY'] || ''),
            city: String(cmlData['CITY'] || cmlData['MUNICIPALITY'] || ''),
            province: String(cmlData['PROVINCE'] || ''),
          };
        }
      }
      return c;
    });

    if (updated) {
      setFormCustomers(remapped);
    }
  }, [currentSalesmanCustomers, formCustomers]);

  // Fetch CML for Read Mode live mapping
  useEffect(() => {
    if (!selectedPicklistForRead || !selectedPicklistForRead.salesmanCode) return;
    
    const safeId = selectedPicklistForRead.salesmanCode.replace(/[^a-zA-Z0-9_]/g, '');
    getDoc(doc(db, 'customer_data', safeId)).then(snap => {
      if (snap.exists()) {
        try {
          const arr = JSON.parse(snap.data().customers || '[]');
          const map: Record<string, any> = {};
          arr.forEach((c: any) => {
            const code = String(c['CUSTOMER CODE'] || c['CUSTOMER NUMBER'] || c['CUSTOMER ID'] || '').toUpperCase();
            if (code) map[code] = c;
          });
          setReadModeCmlMap(map);
        } catch(e) { }
      } else {
        setReadModeCmlMap({});
      }
    });
  }, [selectedPicklistForRead]);

  const filteredPicklists = useMemo(() => {
    let filtered = picklists;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.systemStatus === statusFilter);
    }
    if (filterSalesman !== 'all') {
      filtered = filtered.filter((p) => p.salesmanCode === filterSalesman);
    }
    if (filterCity !== 'all') {
      const selectedCitiesArr = filterCity.split(', ').map(c => c.trim().toLowerCase());
      filtered = filtered.filter((p) => {
        if (!p.city) return false;
        const pCities = p.city.split(', ').map(c => c.trim().toLowerCase());
        return pCities.some(c => selectedCitiesArr.includes(c));
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.picklistNumber.toLowerCase().includes(q) ||
          p.salesmanName.toLowerCase().includes(q) ||
          p.salesmanCode.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q)
      );
    }
    if (viewMode === 'read' && selectedSalesmanForRead) {
      filtered = filtered.filter((p) => p.salesmanCode === selectedSalesmanForRead || p.salesmanName === selectedSalesmanForRead);
    }
    return filtered;
  }, [picklists, statusFilter, filterSalesman, filterCity, searchQuery, viewMode, selectedSalesmanForRead]);

  // Derive unique salesmen for the Read View
  const uniqueSalesmen = useMemo(() => {
    const map = new Map<string, { code: string, name: string, count: number }>();
    picklists.forEach(p => {
      const key = p.salesmanCode || p.salesmanName;
      if (!key) return;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, { code: p.salesmanCode, name: p.salesmanName, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [picklists]);

  const handleCreateNew = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormNumber('');
    setFormCity('');
    setFormSalesmanCode('');
    setFormSalesmanName('');
    setFormCS(0);
    setFormSC(0);
    setFormPC(0);
    setFormAmount(0);
    setFormAccounts(0);
    setFormChecker('');
    setFormCustomers([]);
    setPasteText('');
  };

  const handleSelectForEdit = (record: Picklist) => {
    setEditingRecord(record);
    setFormDate(record.picklistDate);
    setFormNumber(record.picklistNumber);
    setFormCity(record.city);
    setFormSalesmanCode(record.salesmanCode);
    setFormSalesmanName(record.salesmanName);
    setFormCS(record.cs);
    setFormSC(record.sc);
    setFormPC(record.pc);
    setFormAmount(record.estimatedAmount);
    setFormAccounts(record.numberOfAccounts);
    setFormChecker(record.assignedChecker || '');
    setFormCustomers(record.customers || []);
    setPasteText('');
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    const items = pasteText.split(': ;').map(i => i.trim()).filter(Boolean);
    const parsed = items.map(item => {
      const parts = item.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        return { name: parts[0], code: parts[1] };
      }
      return null;
    }).filter(Boolean) as {name: string, code: string}[];

    if (parsed.length > 0) {
      setFormCustomers(prev => {
        const currentCodes = new Set(prev.map(p => p.code));
        const newCustomers = parsed.filter(p => !currentCodes.has(p.code));
        return [...prev, ...newCustomers];
      });
      setPasteText('');
    }
  };

  const handleSaveToDraft = async () => {
    if (!formDate || !formNumber.trim() || !formSalesmanCode.trim()) return;
    setSaving(true);
    try {
      const docId = editingRecord?.id || formNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const payload = {
        id: docId,
        picklistDate: formDate,
        picklistNumber: formNumber.trim(),
        city: formCity.trim(),
        salesmanCode: formSalesmanCode.trim(),
        salesmanName: formSalesmanName.trim(),
        cs: formCS,
        sc: formSC,
        pc: formPC,
        estimatedAmount: formAmount,
        numberOfAccounts: formAccounts,
        systemStatus: editingRecord?.systemStatus || 'Allocated',
        assignedChecker: formChecker.trim() || null,
        customers: formCustomers,
        encoderId: editingRecord?.encoderId || currentUser?.uid || '',
        encoderName: editingRecord?.encoderName || name || '',
        createdAt: editingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveDraft('picklist', payload);
      alert('Saved to local drafts! Sync via the pending cloud button.');
      handleCreateNew();
    } catch (err: any) {
      console.error('Error saving picklist to draft:', err);
      alert('Failed to save draft: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (picklistId: string, newStatus: Picklist['systemStatus']) => {
    try {
      await setDoc(doc(db, 'logistics_picklists', picklistId), { systemStatus: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_picklists', id));
      setDeleteConfirm(null);
      if (editingRecord?.id === id) {
        handleCreateNew();
      }
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const exportRawExcel = () => {
    if (filteredPicklists.length === 0) return alert('No data to export.');
    const ws = XLSX.utils.json_to_sheet(filteredPicklists.map(p => ({
      Date: p.picklistDate,
      'Picklist Number': p.picklistNumber,
      'Salesman Code': p.salesmanCode,
      'Salesman Name': p.salesmanName,
      City: p.city,
      CS: p.cs,
      SC: p.sc,
      PC: p.pc,
      'Est Amount': p.estimatedAmount,
      Accounts: p.numberOfAccounts,
      Status: p.systemStatus,
      Checker: p.assignedChecker,
      Encoder: p.encoderName,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Picklists');
    XLSX.writeFile(wb, `Picklists_Raw_Data.xlsx`);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Completed': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'Scheduled': return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' };
      case 'Invoiced': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      default: return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={24} style={{ color: 'var(--accent-primary)' }} />
            Picklist Management
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage warehouse picking lists and statuses
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {role === 'admin' && (
            <button onClick={exportRawExcel} className="btn" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
              <FileSpreadsheet size={16} /> Export Data
            </button>
          )}

          {(canCreate || canEditStatus) && (
            <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => { setViewMode('read'); setSelectedSalesmanForRead(null); }} 
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
        /* EDIT VIEW: 60/40 Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '24px', flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN: 60% Form */}
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingRecord ? 'Edit Picklist' : 'Create New Picklist'}</h3>
              {editingRecord && (
                <button onClick={handleCreateNew} className="btn" style={{ fontSize: '13px' }}>
                  <Plus size={14} /> New Entry
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1.5fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', whiteSpace: 'nowrap' }}>Picklist Date *</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', whiteSpace: 'nowrap' }}>Picklist Number *</label>
                <input type="text" placeholder="PL-001" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '12px' }} />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>City *</label>
                <button 
                  className="btn" 
                  onClick={() => {
                    setSelectedModalCities(formCity ? formCity.split(', ') : []);
                    setShowCityModal('form');
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '8px', fontSize: '12px' }}
                >
                  <MapPin size={14} style={{ marginRight: '8px', flexShrink: 0 }}/> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formCity || 'Select City...'}</span>
                </button>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Salesman *</label>
                <button 
                  className="btn" 
                  onClick={() => setShowSalesmanModal('form')}
                  style={{ width: '100%', justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '8px', fontSize: '12px' }}
                >
                  <User size={14} style={{ marginRight: '8px', flexShrink: 0 }}/> 
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formSalesmanCode ? `${formSalesmanCode} - ${formSalesmanName}` : 'Select Salesman...'}</span>
                </button>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>CS</label>
                  <input type="number" min={0} value={formCS} onChange={(e) => setFormCS(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>SC</label>
                  <input type="number" min={0} value={formSC} onChange={(e) => setFormSC(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>PC</label>
                  <input type="number" min={0} value={formPC} onChange={(e) => setFormPC(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', whiteSpace: 'nowrap' }}>Est. Amount (₱)</label>
                  <input type="number" min={0} value={formAmount} onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '8px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', whiteSpace: 'nowrap' }}>Accounts</label>
                  <input 
                    type="number" 
                    min={0} 
                    value={formAccounts} 
                    onChange={(e) => setFormAccounts(parseInt(e.target.value) || 0)} 
                    disabled={formCustomers.length > 0}
                    style={{ width: '100%', padding: '8px', opacity: formCustomers.length > 0 ? 0.7 : 1, cursor: formCustomers.length > 0 ? 'not-allowed' : 'auto' }} 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Assigned Checker</label>
                <input type="text" placeholder="Checker name" value={formChecker} onChange={(e) => setFormChecker(e.target.value)} style={{ width: '100%' }} />
              </div>

              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Customer Allocations (Paste DMS Data)</label>
                  <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>{formCustomers.length} Added</span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <textarea
                    placeholder="STORE NAME A | CODE123 | : ;&#10;STORE NAME B | CODE456 | CODE456 : ;"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    style={{ flex: 1, minHeight: '60px', padding: '8px', fontSize: '12px', resize: 'vertical' }}
                  />
                  <button 
                    onClick={handleParsePaste}
                    className="btn btn-primary"
                    disabled={!pasteText.trim()}
                    style={{ flexShrink: 0, padding: '0 16px' }}
                  >
                    Add
                  </button>
                </div>

                {formCustomers.length > 0 && (
                  <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {formCustomers.map((cust, idx) => {
                      const location = [cust.barangay, cust.city, cust.province].filter(Boolean).join(', ');
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'var(--bg-panel)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.name}</span>
                            {location && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><MapPin size={10} style={{ display: 'inline', marginRight: '4px' }}/>{location}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <span style={{ color: 'var(--text-muted)' }}>{cust.code}</span>
                            <button 
                              onClick={() => setFormCustomers(prev => prev.filter((_, i) => i !== idx))}
                              className="btn-icon"
                              style={{ color: 'var(--accent-danger)' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveToDraft}
                className="btn btn-primary"
                disabled={saving || !formDate || !formNumber.trim() || !formSalesmanCode.trim() || !formCity.trim()}
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

          {/* RIGHT COLUMN: 20% List (Edit Mode) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search picklist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%', fontSize: '13px', padding: '8px 8px 8px 36px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowSalesmanModal('filter')}
                className="btn" 
                style={{ flex: 1, justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', overflow: 'hidden' }}
              >
                <User size={14} style={{ flexShrink: 0 }} /> 
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {filterSalesman === 'all' ? 'All Salesmen' : filterSalesman}
                </span>
              </button>
              
              <button 
                onClick={() => {
                  setSelectedModalCities(filterCity === 'all' ? [] : filterCity.split(', '));
                  setShowCityModal('filter');
                }}
                className="btn" 
                style={{ flex: 1, justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', overflow: 'hidden' }}
              >
                <MapPin size={14} style={{ flexShrink: 0 }} /> 
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {filterCity === 'all' ? 'All Cities' : filterCity}
                </span>
              </button>
              
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ flex: 1, fontSize: '13px' }}
              >
                <option value="all">All Statuses</option>
                <option value="Allocated">Allocated</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : filteredPicklists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No records found</div>
              ) : (
                filteredPicklists.slice(0, 10).map((pl) => (
                  <div
                    key={pl.id}
                    className={`glass-panel ${editingRecord?.id === pl.id ? 'active' : ''}`}
                    style={{
                      padding: '12px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                      border: editingRecord?.id === pl.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                    }}
                    onClick={() => handleSelectForEdit(pl)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>#{pl.picklistNumber}</div>
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(pl.id); }}
                          className="btn-icon"
                          style={{ width: '24px', height: '24px' }}
                        >
                          <Trash2 size={12} color="var(--accent-danger)" />
                        </button>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {pl.picklistDate} • {pl.city || 'No City'}
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-main)' }}>{pl.salesmanCode}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                        background: getStatusStyle(pl.systemStatus).bg, color: getStatusStyle(pl.systemStatus).color
                      }}>
                        {pl.systemStatus}
                      </span>
                    </div>

                    {deleteConfirm === pl.id && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)',
                        backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px',
                        zIndex: 5, animation: 'fadeIn 0.2s ease-out',
                      }}>
                        <p style={{ fontSize: '12px', textAlign: 'center', margin: 0 }}>Delete?</p>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="btn" style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(pl.id); }} className="btn" style={{ background: 'var(--accent-danger)', color: 'white', fontSize: '11px', padding: '4px 8px' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* READ VIEW: 60/40 Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '24px', flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN: 60% Filter & Salesman Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'hidden' }}>
            {/* Top 50%: Salesman Cards */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '50%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <User size={18} /> Select Salesman
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', overflowY: 'auto', paddingRight: '8px' }}>
                <div 
                  className={`glass-panel ${selectedSalesmanForRead === null ? 'active' : ''}`}
                  onClick={() => setSelectedSalesmanForRead(null)}
                  style={{ 
                    padding: '16px', cursor: 'pointer', textAlign: 'center', 
                    border: selectedSalesmanForRead === null ? '1px solid var(--accent-primary)' : '1px solid var(--border)' 
                  }}
                >
                  <div style={{ fontWeight: 600 }}>All Salesmen</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{picklists.length} picklists</div>
                </div>
                {uniqueSalesmen.map(sm => (
                  <div 
                    key={sm.code || sm.name}
                    className={`glass-panel ${selectedSalesmanForRead === (sm.code || sm.name) ? 'active' : ''}`}
                    onClick={() => setSelectedSalesmanForRead(sm.code || sm.name)}
                    style={{ 
                      padding: '16px', cursor: 'pointer', textAlign: 'center', 
                      border: selectedSalesmanForRead === (sm.code || sm.name) ? '1px solid var(--accent-primary)' : '1px solid var(--border)' 
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{sm.name || sm.code}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sm.code}</div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '8px' }}>{sm.count} picklists</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom 50%: Customers Allocation Placeholder */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', height: '50%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <Briefcase size={18} /> Customer Allocations
              </h3>
              <div style={{ position: 'relative', marginBottom: '16px', flexShrink: 0 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '36px' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {selectedPicklistForRead ? (
                  selectedPicklistForRead.customers && selectedPicklistForRead.customers.length > 0 ? (
                    <div style={{ overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedPicklistForRead.customers
                        .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || c.code.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                        .map((c, i) => {
                          const cmlInfo = readModeCmlMap[c.code.toUpperCase()];
                          const brgy = c.barangay || (cmlInfo ? (cmlInfo['BARANGAY'] || cmlInfo['BRGY']) : '');
                          const cty = c.city || (cmlInfo ? (cmlInfo['CITY'] || cmlInfo['MUNICIPALITY']) : '');
                          const prov = c.province || (cmlInfo ? cmlInfo['PROVINCE'] : '');
                          const location = [brgy, cty, prov].filter(Boolean).join(', ');

                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</span>
                                {location && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><MapPin size={10} style={{ display: 'inline', marginRight: '4px' }}/>{location}</span>}
                              </div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.code}</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '14px', margin: 0 }}>No customers allocated</p>
                        <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>This picklist has no customer data.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '14px', margin: 0, fontWeight: 500 }}>Select a Picklist</p>
                      <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>Click a picklist card to view customers</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 20% Picklist Cards (Selected Salesman) */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden', padding: '16px', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              Results ({filteredPicklists.length})
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search picklist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '28px', width: '100%', fontSize: '12px', padding: '6px 6px 6px 28px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setShowSalesmanModal('filter')}
                  className="btn" 
                  style={{ flex: 1, justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: '12px', padding: '6px', overflow: 'hidden' }}
                >
                  <User size={12} style={{ flexShrink: 0 }} /> 
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {filterSalesman === 'all' ? 'All Salesmen' : filterSalesman}
                  </span>
                </button>
                
                <button 
                  onClick={() => {
                    setSelectedModalCities(filterCity === 'all' ? [] : filterCity.split(', '));
                    setShowCityModal('filter');
                  }}
                  className="btn" 
                  style={{ flex: 1, justifyContent: 'flex-start', background: 'var(--bg-panel)', border: '1px solid var(--border)', fontSize: '12px', padding: '6px', overflow: 'hidden' }}
                >
                  <MapPin size={12} style={{ flexShrink: 0 }} /> 
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {filterCity === 'all' ? 'All Cities' : filterCity}
                  </span>
                </button>
  
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ flex: 1, fontSize: '12px', padding: '6px' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Allocated">Allocated</option>
                  <option value="Invoiced">Invoiced</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginTop: '8px' }}>
              {filteredPicklists.slice(0, 10).map(pl => {
                const sty = getStatusStyle(pl.systemStatus);
                return (
                  <div 
                    key={pl.id} 
                    onClick={() => setSelectedPicklistForRead(pl)}
                    style={{ 
                      padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', 
                      border: selectedPicklistForRead?.id === pl.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      cursor: 'pointer' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px' }}>#{pl.picklistNumber}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pl.picklistDate}</div>
                      </div>
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                        background: sty.bg, color: sty.color
                      }}>
                        {pl.systemStatus}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '12px' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Salesman:</span> {pl.salesmanCode}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>City:</span> {pl.city || '—'}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Accounts:</span> {pl.numberOfAccounts}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>CS:</span> {pl.cs}</div>
                      <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>Est. Amount:</span> ₱{pl.estimatedAmount.toLocaleString()}</div>
                    </div>

                    {canEditStatus && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(['Allocated', 'Invoiced', 'Scheduled', 'Completed'] as Picklist['systemStatus'][]).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleStatusUpdate(pl.id, st)}
                            className="btn"
                            disabled={pl.systemStatus === st}
                            style={{
                              fontSize: '10px', padding: '4px 6px', borderRadius: '4px',
                              background: pl.systemStatus === st ? getStatusStyle(st).bg : 'transparent',
                              color: pl.systemStatus === st ? getStatusStyle(st).color : 'var(--text-muted)',
                              border: `1px solid ${pl.systemStatus === st ? getStatusStyle(st).border : 'var(--border)'}`,
                              cursor: pl.systemStatus === st ? 'default' : 'pointer',
                              opacity: pl.systemStatus === st ? 1 : 0.7,
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSalesmanModal && (
        <Modal isOpen={true} onClose={() => { setShowSalesmanModal(null); setModalSearch(''); }} title="Select Salesman">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search salesman..." 
                autoFocus
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {showSalesmanModal === 'filter' && (
                <div onClick={() => { setFilterSalesman('all'); setShowSalesmanModal(null); setModalSearch(''); }} className="glass-panel hover-bright" style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600 }}>All Salesmen</div>
                </div>
              )}
              {salesmenList.filter(s => s.name.toLowerCase().includes(modalSearch.toLowerCase()) || s.code.toLowerCase().includes(modalSearch.toLowerCase())).map(s => (
                <div 
                  key={s.code} 
                  onClick={() => { 
                    if (showSalesmanModal === 'form') { setFormSalesmanCode(s.code); setFormSalesmanName(s.name); }
                    else { setFilterSalesman(s.code); }
                    setShowSalesmanModal(null); setModalSearch('');
                  }} 
                  className="glass-panel hover-bright" 
                  style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.code}</div>
                </div>
              ))}
              {salesmenList.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No salesmen found.</div>}
            </div>
          </div>
        </Modal>
      )}

      {showCityModal && (
        <Modal isOpen={true} onClose={() => { setShowCityModal(null); setModalSearch(''); setSelectedModalCities([]); }} title="Select City">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search city..." 
                autoFocus
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '36px' }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {showCityModal === 'filter' && (
                <div onClick={() => { setSelectedModalCities([]); }} className={`glass-panel hover-bright ${selectedModalCities.length === 0 ? 'active' : ''}`} style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: selectedModalCities.length === 0 ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                  <div style={{ fontWeight: 600 }}>All Cities</div>
                </div>
              )}
              {showCityModal === 'form' && modalSearch && !allCities.some(c => c.toLowerCase() === modalSearch.toLowerCase()) && (
                <div 
                  onClick={() => {
                    const newCity = modalSearch.trim();
                    if (!selectedModalCities.includes(newCity)) {
                      setSelectedModalCities([...selectedModalCities, newCity]);
                    }
                    setModalSearch('');
                  }}
                  className="glass-panel hover-bright" 
                  style={{ cursor: 'pointer', padding: '12px', borderRadius: '8px', border: '1px dashed var(--accent-primary)', color: 'var(--accent-primary)' }}
                >
                  <div style={{ fontWeight: 600 }}>+ Select "{modalSearch}"</div>
                </div>
              )}
              {allCities.filter(c => c.toLowerCase().includes(modalSearch.toLowerCase())).map(c => {
                const isSelected = selectedModalCities.includes(c);
                return (
                  <div 
                    key={c} 
                    onClick={() => {
                      if (isSelected) {
                        setSelectedModalCities(selectedModalCities.filter(sc => sc !== c));
                      } else {
                        setSelectedModalCities([...selectedModalCities, c]);
                      }
                    }} 
                    className={`glass-panel hover-bright ${isSelected ? 'active' : ''}`} 
                    style={{ 
                      cursor: 'pointer', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{c}</div>
                    {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />}
                  </div>
                );
              })}
            </div>
            
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => {
                  const val = selectedModalCities.length > 0 ? selectedModalCities.join(', ') : (showCityModal === 'filter' ? 'all' : '');
                  if (showCityModal === 'form') setFormCity(val);
                  else setFilterCity(val);
                  setShowCityModal(null);
                  setModalSearch('');
                  setSelectedModalCities([]);
                }}
              >
                Apply ({selectedModalCities.length} Selected)
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default PicklistPage;
