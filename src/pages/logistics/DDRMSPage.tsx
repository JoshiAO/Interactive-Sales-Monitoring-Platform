import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileSpreadsheet, Plus, Search, Download, Printer, Save, Trash2, ChevronDown, ChevronUp, DollarSign, AlertTriangle, ClipboardPaste, Settings, Eye, Edit3 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { saveDraft } from '../../utils/indexedDB';
import type { DDRMSHeader, DDRMSInvoice, DDRMSGlobalConfig, DDRMSCollection, RemittanceCheck } from '../../types/logistics';
import { DELIVERY_STATUS_PRIORITY } from '../../types/logistics';

// ─── DDRMS Page Component ───────────────────────────────────────────────────
const DDRMSPage: React.FC = () => {
  const { role, currentUser, name } = useAuth();
  const [ddrmsRecords, setDdrmsRecords] = useState<DDRMSHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Create DDRMS Modal state
  // const [showCreateModal, setShowCreateModal] = useState(false);
  const [formNumber, setFormNumber] = useState('');
  const [formSalesmanCode, setFormSalesmanCode] = useState('');
  const [formSalesmanName, setFormSalesmanName] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDriver, setFormDriver] = useState('');
  const [formHelpers, setFormHelpers] = useState(0);
  const [formCity, setFormCity] = useState('');
  const [formInvoices, setFormInvoices] = useState<DDRMSInvoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingDDRMS, setEditingDDRMS] = useState<DDRMSHeader | null>(null);

  // Clipboard Paste Area
  const [showPasteArea, setShowPasteArea] = useState(false);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // Collection Modal
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionDDRMS, setCollectionDDRMS] = useState<DDRMSHeader | null>(null);
  const [collectionCash, setCollectionCash] = useState(0);
  const [collectionChecks, setCollectionChecks] = useState<RemittanceCheck[]>([]);
  const [collectionDRs, setCollectionDRs] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  // Global Config Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<DDRMSGlobalConfig>({
    companyName: '',
    divisionTitle: '',
    officerInChargeCashierName: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');

  const canCreate = role === 'admin' || role === 'encoder';
  const canExport = role === 'admin';
  const canConfigureGlobal = role === 'admin';
  const canCollect = role === 'admin' || role === 'encoder';

  const [viewMode, setViewMode] = useState<'edit' | 'read'>(canCreate ? 'edit' : 'read');

  // ─── Real-time listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'logistics_ddrms'), (snap) => {
        const records: DDRMSHeader[] = [];
        snap.forEach((d) => records.push({ id: d.id, ...d.data() } as DDRMSHeader));
        records.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.ddrmsNumber.localeCompare(a.ddrmsNumber));
        setDdrmsRecords(records);
        setLoading(false);
      }),
    ];

    // Fetch global config
    getDoc(doc(db, 'settings', 'ddrms_config')).then((snap) => {
      if (snap.exists()) {
        setGlobalConfig(snap.data() as DDRMSGlobalConfig);
      }
    });

    return () => unsubs.forEach((u) => u());
  }, []);

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let filtered = ddrmsRecords;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.ddrmsNumber.toLowerCase().includes(q) ||
          d.salesmanName.toLowerCase().includes(q) ||
          d.salesmanCode.toLowerCase().includes(q) ||
          d.routeCity.toLowerCase().includes(q) ||
          d.plateNumber.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [ddrmsRecords, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, Draft: 0, Submitted: 0, 'On The Way': 0, Delivered: 0, Remitted: 0 };
    ddrmsRecords.forEach((d) => {
      counts.all++;
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [ddrmsRecords]);

  // ─── Excel Clipboard Paste Parser ─────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;

    const lines = text.split('\n').filter((l) => l.trim());
    const parsed: DDRMSInvoice[] = [];

    lines.forEach((line, idx) => {
      const cells = line.split('\t');
      if (cells.length < 5) return; // Minimum columns needed

      const invoice: DDRMSInvoice = {
        id: `inv_${Date.now()}_${idx}`,
        invoiceDate: cells[0]?.trim() || '',
        picklistNumber: cells[1]?.trim() || '',
        systemInvoiceNumber: cells[2]?.trim() || '',
        invoiceNumberSeries: cells[3]?.trim() || '',
        customerCode: cells[4]?.trim() || '',
        customerName: cells[5]?.trim() || '',
        barangay: cells[6]?.trim() || '',
        city: cells[7]?.trim() || '',
        province: cells[8]?.trim() || '',
        grossAmount: parseFloat(cells[9]?.trim() || '0') || 0,
        cs: parseInt(cells[10]?.trim() || '0') || 0,
        pc: parseInt(cells[11]?.trim() || '0') || 0,
        sc: parseInt(cells[12]?.trim() || '0') || 0,
        deliveryStatus: 'Pending',
        updatedAt: new Date().toISOString(),
      };
      parsed.push(invoice);
    });

    if (parsed.length > 0) {
      setFormInvoices((prev) => [...prev, ...parsed]);
      setShowPasteArea(false);
      if (pasteRef.current) pasteRef.current.value = '';
    } else {
      alert('Could not parse clipboard data. Expected tab-separated values with at least 5 columns.');
    }
  }, []);

  // ─── Add Manual Invoice Row ───────────────────────────────────────────────
  const handleAddInvoiceRow = () => {
    setFormInvoices((prev) => [
      ...prev,
      {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        invoiceDate: formDate || '',
        picklistNumber: '',
        systemInvoiceNumber: '',
        invoiceNumberSeries: '',
        customerCode: '',
        customerName: '',
        barangay: '',
        city: formCity || '',
        province: '',
        grossAmount: 0,
        cs: 0,
        pc: 0,
        sc: 0,
        deliveryStatus: 'Pending',
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleUpdateInvoice = (index: number, field: keyof DDRMSInvoice, value: any) => {
    setFormInvoices((prev) =>
      prev.map((inv, i) => (i === index ? { ...inv, [field]: value } : inv))
    );
  };

  const handleRemoveInvoice = (index: number) => {
    setFormInvoices((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Save DDRMS ──────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingDDRMS(null);
    setFormNumber('');
    setFormSalesmanCode('');
    setFormSalesmanName('');
    setFormPlate('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDriver('');
    setFormHelpers(0);
    setFormCity('');
    setFormInvoices([]);
  };

  const handleOpenEdit = (ddrms: DDRMSHeader) => {
    setEditingDDRMS(ddrms);
    setFormNumber(ddrms.ddrmsNumber);
    setFormSalesmanCode(ddrms.salesmanCode);
    setFormSalesmanName(ddrms.salesmanName);
    setFormPlate(ddrms.plateNumber);
    setFormDate(ddrms.deliveryDate);
    setFormDriver(ddrms.driverName);
    setFormHelpers(ddrms.noOfHelpers);
    setFormCity(ddrms.routeCity);
    setFormInvoices(ddrms.invoices ? [...ddrms.invoices] : []);
  };

  const handleSaveDDRMS = async () => {
    if (!formNumber.trim() || !formSalesmanCode.trim() || !formDate) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const docId = editingDDRMS?.id || formNumber.replace(/[^a-zA-Z0-9_-]/g, '_');

      const totals = formInvoices.reduce(
        (acc, inv) => ({
          totalGrossAmount: acc.totalGrossAmount + inv.grossAmount,
          totalCS: acc.totalCS + inv.cs,
          totalPC: acc.totalPC + inv.pc,
          totalSC: acc.totalSC + inv.sc,
        }),
        { totalGrossAmount: 0, totalCS: 0, totalPC: 0, totalSC: 0 }
      );

      const payload = {
        id: docId,
        ddrmsNumber: formNumber.trim(),
        salesmanCode: formSalesmanCode.trim(),
        salesmanName: formSalesmanName.trim(),
        plateNumber: formPlate.trim(),
        deliveryDate: formDate,
        driverName: formDriver.trim(),
        noOfHelpers: formHelpers,
        routeCity: formCity.trim(),
        encoderId: editingDDRMS?.encoderId || currentUser?.uid || '',
        encoderName: editingDDRMS?.encoderName || name || '',
        companyName: globalConfig.companyName,
        divisionTitle: globalConfig.divisionTitle,
        officerInChargeCashierName: globalConfig.officerInChargeCashierName,
        status: editingDDRMS?.status || 'Draft',
        invoices: formInvoices,
        ...totals,
        createdAt: editingDDRMS?.createdAt || now,
        updatedAt: now,
      };

      await saveDraft('ddrms', payload);
      alert('Saved to local drafts! Sync via the pending cloud button.');
      handleOpenCreate();
    } catch (err: any) {
      console.error('Error saving DDRMS to draft:', err);
      alert('Failed to save draft: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_ddrms', id));
      setDeleteConfirm(null);
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  // ─── Save Global Config ──────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, 'settings', 'ddrms_config'), globalConfig);
      setShowConfigModal(false);
    } catch (err: any) {
      alert('Failed to save config: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // ─── Collection (Remittance) ──────────────────────────────────────────────
  const handleOpenCollection = (ddrms: DDRMSHeader) => {
    setCollectionDDRMS(ddrms);
    setCollectionCash(0);
    setCollectionChecks([]);
    setCollectionDRs('');
    setShowCollectionModal(true);
  };

  const handleAddCheck = () => {
    setCollectionChecks((prev) => [...prev, { bankName: '', checkNumber: '', checkDate: '', amount: 0 }]);
  };

  const handleUpdateCheck = (idx: number, field: keyof RemittanceCheck, value: any) => {
    setCollectionChecks((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const handleRemoveCheck = (idx: number) => {
    setCollectionChecks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveCollection = async () => {
    if (!collectionDDRMS) return;
    setSavingCollection(true);
    try {
      const now = new Date().toISOString();
      const totalChecks = collectionChecks.reduce((sum, c) => sum + c.amount, 0);
      const totalRemittance = collectionCash + totalChecks;

      // Save collection record
      const collectionId = `col_${collectionDDRMS.id}_${Date.now()}`;
      await setDoc(doc(db, 'logistics_collections', collectionId), {
        ddrmsId: collectionDDRMS.id,
        ddrmsNumber: collectionDDRMS.ddrmsNumber,
        cashAmount: collectionCash,
        checks: collectionChecks.filter((c) => c.amount > 0),
        drNumbers: collectionDRs.split(',').map((d) => d.trim()).filter(Boolean),
        totalRemittance,
        encoderId: currentUser?.uid || '',
        encoderName: name || '',
        createdAt: now,
      } as DDRMSCollection);

      // Update DDRMS status to Remitted
      await updateDoc(doc(db, 'logistics_ddrms', collectionDDRMS.id), {
        status: 'Remitted',
        remittanceCash: collectionCash,
        remittanceChecks: totalChecks,
        remittanceDR: collectionDRs.split(',').map((d) => d.trim()).filter(Boolean).length,
        updatedAt: now,
      });

      setShowCollectionModal(false);
    } catch (err: any) {
      alert('Failed to save collection: ' + err.message);
    } finally {
      setSavingCollection(false);
    }
  };

  // ─── Excel Export ─────────────────────────────────────────────────────────
  const handleExport = async (type: 'raw' | 'formatted') => {
    try {
      const XlsxStyle = await import('xlsx-js-style');
      const XLSX = await import('xlsx');

      // Filter DDRMS by date range
      let exportRecords = ddrmsRecords;
      if (exportDateFrom) exportRecords = exportRecords.filter((d) => d.deliveryDate >= exportDateFrom);
      if (exportDateTo) exportRecords = exportRecords.filter((d) => d.deliveryDate <= exportDateTo);

      if (exportRecords.length === 0) {
        alert('No DDRMS records found for the selected date range');
        return;
      }

      if (type === 'raw') {
        // Raw data export - flat rows
        const wb = XLSX.utils.book_new();
        const rows = exportRecords.flatMap((ddrms) =>
          (ddrms.invoices || []).map((inv) => ({
            'DDRMS No': ddrms.ddrmsNumber,
            'Delivery Date': ddrms.deliveryDate,
            'Salesman Code': ddrms.salesmanCode,
            'Salesman Name': ddrms.salesmanName,
            'Plate No': ddrms.plateNumber,
            'Driver': ddrms.driverName,
            'Route City': ddrms.routeCity,
            'Invoice Date': inv.invoiceDate,
            'Picklist No': inv.picklistNumber,
            'System Invoice No': inv.systemInvoiceNumber,
            'Invoice No (Booklet)': inv.invoiceNumberSeries,
            'Customer Code': inv.customerCode,
            'Customer Name': inv.customerName,
            'Barangay': inv.barangay,
            'City': inv.city,
            'Province': inv.province,
            'Gross Amount': inv.grossAmount,
            'CS': inv.cs,
            'PC': inv.pc,
            'SC': inv.sc,
            'Delivery Status': inv.deliveryStatus,
            'Reason': inv.notDeliveredReason || '',
            'Remarks': inv.remarks || '',
          }))
        );
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'DDRMS Raw Data');
        XLSX.writeFile(wb, `DDRMS_Raw_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx`);
      } else {
        // Formatted export - one sheet per DDRMS with template layout
        const wb = XlsxStyle.utils.book_new();
        exportRecords.forEach((ddrms) => {
          const invoices = ddrms.invoices || [];
          const pageSize = 25;
          const totalPages = Math.ceil(invoices.length / pageSize) || 1;

          // For each page, create rows
          const sheetData: any[][] = [];

          for (let page = 0; page < totalPages; page++) {
            const pageInvoices = invoices.slice(page * pageSize, (page + 1) * pageSize);

            // Header rows
            sheetData.push([ddrms.companyName || globalConfig.companyName || 'Company Name']);
            sheetData.push([ddrms.divisionTitle || globalConfig.divisionTitle || 'Division']);
            sheetData.push(['DAILY DELIVERY REMITTANCE MONITORING SHEET']);
            sheetData.push([]);
            sheetData.push([
              `DDRMS No: ${ddrms.ddrmsNumber}`,
              '', '',
              `Delivery Date: ${ddrms.deliveryDate}`,
              '', '',
              `Salesman: ${ddrms.salesmanCode} - ${ddrms.salesmanName}`,
            ]);
            sheetData.push([
              `Plate No: ${ddrms.plateNumber}`,
              '', '',
              `Driver: ${ddrms.driverName}`,
              '', '',
              `Route/City: ${ddrms.routeCity}`,
            ]);
            sheetData.push([]);

            // Column headers
            sheetData.push([
              '#', 'Invoice Date', 'Picklist No', 'System Invoice No', 'Invoice No (Series)',
              'Customer Code', 'Customer Name', 'Barangay', 'City', 'Province',
              'Gross Amount', 'CS', 'PC', 'SC', 'Status',
            ]);

            // Data rows
            pageInvoices.forEach((inv, idx) => {
              sheetData.push([
                page * pageSize + idx + 1,
                inv.invoiceDate,
                inv.picklistNumber,
                inv.systemInvoiceNumber,
                inv.invoiceNumberSeries,
                inv.customerCode,
                inv.customerName,
                inv.barangay,
                inv.city,
                inv.province,
                inv.grossAmount,
                inv.cs,
                inv.pc,
                inv.sc,
                inv.deliveryStatus,
              ]);
            });

            // Fill empty rows to 25
            for (let i = pageInvoices.length; i < 25; i++) {
              sheetData.push([page * pageSize + i + 1, '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
            }

            // Subtotal row
            const pageTotal = pageInvoices.reduce((s, inv) => s + inv.grossAmount, 0);
            sheetData.push(['', '', '', '', '', '', '', '', '', 'SUBTOTAL:', pageTotal, '', '', '', '']);

            // Page indicator
            if (totalPages > 1) {
              sheetData.push([`Page ${page + 1} of ${totalPages}`]);
            }

            // Spacing between pages
            sheetData.push([]);
          }

          // Grand total row
          const grandTotal = invoices.reduce((s, inv) => s + inv.grossAmount, 0);
          sheetData.push(['', '', '', '', '', '', '', '', '', 'GRAND TOTAL:', grandTotal, '', '', '', '']);

          // Signature block
          sheetData.push([]);
          sheetData.push(['', '', 'Prepared by:', '', '', '', '', 'Checked by:', '', '', '', '', 'Approved by:']);
          sheetData.push([]);
          sheetData.push(['', '', `${ddrms.encoderName || ''}`, '', '', '', '', `${ddrms.officerInChargeCashierName || globalConfig.officerInChargeCashierName || ''}`, '', '', '', '', '_______________']);

          const ws = XlsxStyle.utils.aoa_to_sheet(sheetData);

          // Set column widths
          ws['!cols'] = [
            { wch: 4 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 20 },
            { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
            { wch: 14 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 14 },
          ];

          // Page setup for Folio (8.5x13in) landscape
          ws['!pageSetup'] = { paperSize: 14, orientation: 'landscape', fitToWidth: 1 };

          const sheetName = ddrms.ddrmsNumber.substring(0, 31); // Excel max sheet name length
          XlsxStyle.utils.book_append_sheet(wb, ws, sheetName);
        });

        XlsxStyle.writeFile(wb, `DDRMS_Formatted_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx`);
      }
      setShowExportModal(false);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
    }
  };

  // ─── Status Styling ───────────────────────────────────────────────────────
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Remitted': return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'Delivered': return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
      case 'On The Way': return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Submitted': return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' };
      default: return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={24} style={{ color: 'var(--accent-primary)' }} />
            DDRMS
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Daily Delivery Remittance Monitoring Sheet
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canConfigureGlobal && (
            <button onClick={() => setShowConfigModal(true)} className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }} id="ddrms-config-btn">
              <Settings size={14} /> Config
            </button>
          )}
          {canExport && (
            <button onClick={() => setShowExportModal(true)} className="btn" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '13px' }} id="ddrms-export-btn">
              <Download size={14} /> Export
            </button>
          )}
          {canCreate && (
            <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)', marginLeft: '8px' }}>
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
        /* EDIT VIEW 80/20 Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '8fr 2fr', gap: '24px', flex: 1, minHeight: 0 }}>
          {/* LEFT 80% Form */}
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingDDRMS ? 'Edit DDRMS' : 'Create New DDRMS'}</h3>
              {editingDDRMS && (
                <button onClick={handleOpenCreate} className="btn" style={{ fontSize: '13px' }}>
                  <Plus size={14} /> New Entry
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Header Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>DDRMS No *</label>
                  <input type="text" value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="DDRMS-001" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Delivery Date *</label>
                  <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Salesman Code *</label>
                  <input type="text" value={formSalesmanCode} onChange={(e) => setFormSalesmanCode(e.target.value)} placeholder="SM001" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Salesman Name</label>
                  <input type="text" value={formSalesmanName} onChange={(e) => setFormSalesmanName(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Plate Number</label>
                  <input type="text" value={formPlate} onChange={(e) => setFormPlate(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Driver Name</label>
                  <input type="text" value={formDriver} onChange={(e) => setFormDriver(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>No. of Helpers</label>
                  <input type="number" min={0} value={formHelpers} onChange={(e) => setFormHelpers(parseInt(e.target.value) || 0)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Route / City</label>
                  <input type="text" value={formCity} onChange={(e) => setFormCity(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>

              {/* Invoice Entry Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>Invoice Line Items ({formInvoices.length})</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowPasteArea(!showPasteArea)}
                      className="btn"
                      style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                    >
                      <ClipboardPaste size={14} /> Paste from Excel
                    </button>
                    <button
                      onClick={handleAddInvoiceRow}
                      className="btn"
                      style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
                    >
                      <Plus size={14} /> Add Row
                    </button>
                  </div>
                </div>

                {/* Paste Area */}
                {showPasteArea && (
                  <div style={{ marginBottom: '12px', animation: 'fadeIn 0.2s ease-out' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Paste tab-separated data from Excel. Expected columns: Invoice Date, Picklist#, System Inv#, Invoice Series, Customer Code, Customer Name, Barangay, City, Province, Amount, CS, PC, SC
                    </div>
                    <textarea
                      ref={pasteRef}
                      onPaste={handlePaste}
                      placeholder="Click here and press Ctrl+V to paste Excel data..."
                      rows={3}
                      style={{ background: 'rgba(139, 92, 246, 0.05)', border: '2px dashed rgba(139, 92, 246, 0.3)', width: '100%' }}
                    />
                  </div>
                )}

                {/* Invoice Table Editor */}
                {formInvoices.length > 0 && (
                  <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 2 }}>
                        <tr>
                          {['#', 'Date', 'PL#', 'Sys Inv#', 'Booklet Series', 'Cust Code', 'Cust Name', 'Amount', ''].map((h) => (
                            <th key={h} style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {formInvoices.map((inv, i) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '4px', color: 'var(--text-muted)', width: '30px' }}>{i + 1}</td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.invoiceDate} onChange={(e) => handleUpdateInvoice(i, 'invoiceDate', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '90px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.picklistNumber} onChange={(e) => handleUpdateInvoice(i, 'picklistNumber', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '70px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.systemInvoiceNumber} onChange={(e) => handleUpdateInvoice(i, 'systemInvoiceNumber', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '100px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.invoiceNumberSeries} onChange={(e) => handleUpdateInvoice(i, 'invoiceNumberSeries', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '120px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.customerCode} onChange={(e) => handleUpdateInvoice(i, 'customerCode', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '80px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.customerName} onChange={(e) => handleUpdateInvoice(i, 'customerName', e.target.value)} style={{ padding: '4px 6px', fontSize: '12px', width: '140px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="number" value={inv.grossAmount} onChange={(e) => handleUpdateInvoice(i, 'grossAmount', parseFloat(e.target.value) || 0)} style={{ padding: '4px 6px', fontSize: '12px', width: '90px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <button onClick={() => handleRemoveInvoice(i)} className="btn-icon" style={{ width: '24px', height: '24px' }}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Invoice Totals */}
                {formInvoices.length > 0 && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span>Total Invoices: <strong>{formInvoices.length}</strong></span>
                    <span>Total Amount: <strong style={{ color: 'var(--accent-success)' }}>₱{formInvoices.reduce((s, i) => s + i.grossAmount, 0).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveDDRMS}
                className="btn btn-primary"
                disabled={saving || !formNumber.trim() || !formSalesmanCode.trim() || !formDate}
                style={{ padding: '12px 24px', fontSize: '14px' }}
              >
                {saving ? (
                  <><span className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block' }} /> Saving...</>
                ) : (
                  <><Save size={18} /> {editingDDRMS ? 'Update & Save to Draft' : 'Save to Draft'}</>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT 20% Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search DDRMS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', width: '100%', fontSize: '13px', padding: '8px 8px 8px 36px' }}
              />
            </div>

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="On The Way">On The Way</option>
              <option value="Delivered">Delivered</option>
              <option value="Remitted">Remitted</option>
            </select>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : filteredRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No records found</div>
              ) : (
                filteredRecords.slice(0, 10).map((ddrms) => {
                  const sty = getStatusStyle(ddrms.status);
                  return (
                    <div
                      key={ddrms.id}
                      className={`glass-panel ${editingDDRMS?.id === ddrms.id ? 'active' : ''}`}
                      style={{
                        padding: '12px', borderRadius: '12px', cursor: 'pointer', position: 'relative',
                        border: editingDDRMS?.id === ddrms.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      }}
                      onClick={() => handleOpenEdit(ddrms)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>#{ddrms.ddrmsNumber}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ddrms.id); }}
                          className="btn-icon"
                          style={{ width: '24px', height: '24px' }}
                        >
                          <Trash2 size={12} color="var(--accent-danger)" />
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{ddrms.deliveryDate}</div>
                      
                      <div style={{ marginTop: '8px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>SM:</span> {ddrms.salesmanName}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>City:</span> {ddrms.routeCity}
                      </div>
                      
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 600, color: 'var(--accent-success)', fontSize: '13px' }}>
                          ₱{(ddrms.totalGrossAmount || 0).toLocaleString()}
                        </div>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                          background: sty.bg, color: sty.color
                        }}>
                          {ddrms.status}
                        </span>
                      </div>

                      {deleteConfirm === ddrms.id && (
                        <div style={{
                          position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)',
                          backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px',
                          zIndex: 5, animation: 'fadeIn 0.2s ease-out',
                        }}>
                          <p style={{ fontSize: '12px', textAlign: 'center', margin: 0 }}>Delete?</p>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="btn" style={{ fontSize: '11px', padding: '4px 8px' }}>Cancel</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(ddrms.id); }} className="btn" style={{ background: 'var(--accent-danger)', color: 'white', fontSize: '11px', padding: '4px 8px' }}>Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* READ VIEW (Original Layout) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'Draft', 'Submitted', 'On The Way', 'Delivered', 'Remitted'].map((tab) => {
              const sty = tab === 'all' ? { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-main)', border: 'var(--accent-primary)' } : getStatusStyle(tab);
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className="btn"
                  style={{
                    padding: '8px 14px', fontSize: '13px', borderRadius: '8px',
                    background: statusFilter === tab ? sty.bg : 'rgba(255,255,255,0.03)',
                    color: statusFilter === tab ? sty.color : 'var(--text-muted)',
                    border: `1px solid ${statusFilter === tab ? sty.border : 'var(--border)'}`,
                    fontWeight: statusFilter === tab ? 600 : 400,
                  }}
                >
                  {tab === 'all' ? 'All' : tab} <span style={{ opacity: 0.7 }}>({statusCounts[tab] || 0})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search DDRMS #, salesman, plate, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          {/* DDRMS Card List */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel skeleton" style={{ height: '110px', borderRadius: '12px' }} />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <FileSpreadsheet size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>No DDRMS records found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRecords.map((ddrms, idx) => {
                const sty = getStatusStyle(ddrms.status);
                const isExpanded = expandedId === ddrms.id;
                const notDeliveredCount = (ddrms.invoices || []).filter((i) => i.deliveryStatus === 'Not Delivered').length;

                return (
                  <div
                    key={ddrms.id}
                    className="glass-panel"
                    style={{
                      padding: '16px 20px', borderRadius: '12px',
                      animation: `fadeIn 0.3s ease-out ${idx * 0.04}s both`,
                      borderLeft: `3px solid ${sty.color}`,
                      position: 'relative',
                    }}
                  >
                    {/* Card Header */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', flexWrap: 'wrap' }}
                      onClick={() => setExpandedId(isExpanded ? null : ddrms.id)}
                    >
                      <div style={{ minWidth: '100px' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>#{ddrms.ddrmsNumber}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ddrms.deliveryDate}</div>
                      </div>

                      <div style={{ flex: 1, minWidth: '130px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{ddrms.salesmanName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          🚚 {ddrms.plateNumber} • {ddrms.routeCity}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent-success)' }}>
                          ₱{(ddrms.totalGrossAmount || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {(ddrms.invoices || []).length} invoices
                        </div>
                      </div>

                      {/* Not Delivered Warning */}
                      {notDeliveredCount > 0 && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                          background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                        }}>
                          <AlertTriangle size={12} /> {notDeliveredCount} Not Delivered
                        </span>
                      )}

                      {/* Status Badge */}
                      <span style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        background: sty.bg, color: sty.color, border: `1px solid ${sty.border}`,
                      }}>
                        {ddrms.status}
                      </span>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {canCollect && ddrms.status === 'Delivered' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenCollection(ddrms); }}
                            className="btn"
                            style={{ fontSize: '11px', padding: '5px 10px', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
                          >
                            <DollarSign size={12} /> Collect
                          </button>
                        )}
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Expanded Invoice Table */}
                    {isExpanded && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', animation: 'fadeIn 0.2s ease-out' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['#', 'Inv Date', 'PL#', 'System Inv#', 'Booklet Series', 'Customer', 'City', 'Amount', 'CS', 'Status'].map((h) => (
                                  <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(ddrms.invoices || [])
                                .sort((a, b) => (DELIVERY_STATUS_PRIORITY[a.deliveryStatus] ?? 99) - (DELIVERY_STATUS_PRIORITY[b.deliveryStatus] ?? 99))
                                .map((inv, i) => {
                                  const isND = inv.deliveryStatus === 'Not Delivered';
                                  return (
                                    <tr
                                      key={inv.id || i}
                                      style={{
                                        borderBottom: '1px solid var(--border)',
                                        background: isND ? 'rgba(239, 68, 68, 0.08)' : undefined,
                                      }}
                                    >
                                      <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>{i + 1}</td>
                                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{inv.invoiceDate}</td>
                                      <td style={{ padding: '8px 6px' }}>{inv.picklistNumber}</td>
                                      <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontWeight: 600 }}>{inv.systemInvoiceNumber}</td>
                                      <td style={{ padding: '8px 6px', fontSize: '12px' }}>{inv.invoiceNumberSeries}</td>
                                      <td style={{ padding: '8px 6px' }}>{inv.customerName}</td>
                                      <td style={{ padding: '8px 6px' }}>{inv.city}</td>
                                      <td style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>₱{inv.grossAmount.toLocaleString()}</td>
                                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{inv.cs}</td>
                                      <td style={{ padding: '8px 6px' }}>
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                          background: isND ? 'rgba(239,68,68,0.15)' : inv.deliveryStatus === 'Delivered' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                          color: isND ? '#ef4444' : inv.deliveryStatus === 'Delivered' ? '#10b981' : '#f59e0b',
                                        }}>
                                          {isND && '🚨 '}{inv.deliveryStatus}
                                        </span>
                                        {isND && inv.notDeliveredReason && (
                                          <div style={{ fontSize: '10px', color: '#fca5a5', marginTop: '2px' }}>{inv.notDeliveredReason}</div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                            <tfoot>
                              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                                <td colSpan={7} style={{ padding: '8px 6px', textAlign: 'right' }}>TOTAL</td>
                                <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--accent-success)' }}>₱{(ddrms.totalGrossAmount || 0).toLocaleString()}</td>
                                <td style={{ padding: '8px 6px', textAlign: 'center' }}>{ddrms.totalCS || 0}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Collection Modal ────────────────────────────────────────────── */}
      <Modal isOpen={showCollectionModal} onClose={() => setShowCollectionModal(false)} title="Collection / Remittance" maxWidth="550px">
        {collectionDDRMS && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>DDRMS #{collectionDDRMS.ddrmsNumber}</div>
              <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--accent-success)', marginTop: '4px' }}>
                ₱{(collectionDDRMS.totalGrossAmount || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {collectionDDRMS.salesmanName} • {collectionDDRMS.routeCity}
              </div>
            </div>

            {/* Cash */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Cash Collected (₱)</label>
              <input type="number" min={0} value={collectionCash} onChange={(e) => setCollectionCash(parseFloat(e.target.value) || 0)} style={{ width: '100%' }} />
            </div>

            {/* Checks */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Checks ({collectionChecks.length})</label>
                <button onClick={handleAddCheck} className="btn" style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none' }}>
                  <Plus size={12} /> Add Check
                </button>
              </div>
              {collectionChecks.map((check, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 30px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                  <input type="text" placeholder="Bank" value={check.bankName} onChange={(e) => handleUpdateCheck(i, 'bankName', e.target.value)} style={{ fontSize: '12px', padding: '6px', width: '100%' }} />
                  <input type="text" placeholder="Check #" value={check.checkNumber} onChange={(e) => handleUpdateCheck(i, 'checkNumber', e.target.value)} style={{ fontSize: '12px', padding: '6px', width: '100%' }} />
                  <input type="date" value={check.checkDate} onChange={(e) => handleUpdateCheck(i, 'checkDate', e.target.value)} style={{ fontSize: '12px', padding: '6px', width: '100%' }} />
                  <input type="number" placeholder="₱" value={check.amount} onChange={(e) => handleUpdateCheck(i, 'amount', parseFloat(e.target.value) || 0)} style={{ fontSize: '12px', padding: '6px', width: '100%' }} />
                  <button onClick={() => handleRemoveCheck(i)} className="btn-icon" style={{ width: '24px', height: '24px' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* DR Numbers */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>DR Numbers (comma-separated)</label>
              <input type="text" value={collectionDRs} onChange={(e) => setCollectionDRs(e.target.value)} placeholder="DR001, DR002" style={{ width: '100%' }} />
            </div>

            {/* Remittance Summary */}
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Total Remittance</div>
              <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-success)' }}>
                ₱{(collectionCash + collectionChecks.reduce((s, c) => s + c.amount, 0)).toLocaleString()}
              </div>
            </div>

            <button
              onClick={handleSaveCollection}
              className="btn btn-primary"
              disabled={savingCollection}
              style={{ background: 'var(--accent-success)' }}
              id="save-collection-btn"
            >
              {savingCollection ? 'Saving...' : <><DollarSign size={16} /> Submit Collection & Mark Remitted</>}
            </button>
          </div>
        )}
      </Modal>

      {/* ─── Global Config Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="DDRMS Global Configuration" maxWidth="450px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Company Name</label>
            <input type="text" value={globalConfig.companyName} onChange={(e) => setGlobalConfig((c) => ({ ...c, companyName: e.target.value }))} placeholder="Your Company Name" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Division Title</label>
            <input type="text" value={globalConfig.divisionTitle} onChange={(e) => setGlobalConfig((c) => ({ ...c, divisionTitle: e.target.value }))} placeholder="Division / Department" style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Officer-in-Charge / Cashier Name</label>
            <input type="text" value={globalConfig.officerInChargeCashierName} onChange={(e) => setGlobalConfig((c) => ({ ...c, officerInChargeCashierName: e.target.value }))} placeholder="Full name" style={{ width: '100%' }} />
          </div>
          <button onClick={handleSaveConfig} className="btn btn-primary" disabled={savingConfig} id="save-config-btn">
            {savingConfig ? 'Saving...' : <><Save size={16} /> Save Configuration</>}
          </button>
        </div>
      </Modal>

      {/* ─── Export Modal ────────────────────────────────────────────────── */}
      <Modal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export DDRMS" maxWidth="450px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Date From</label>
              <input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Date To</label>
              <input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Choose your export format:
          </p>
          <button
            onClick={() => handleExport('raw')}
            className="btn"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', justifyContent: 'flex-start' }}
          >
            <Download size={16} /> Raw Data Export (flat rows, single sheet)
          </button>
          <button
            onClick={() => handleExport('formatted')}
            className="btn"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', justifyContent: 'flex-start' }}
          >
            <Printer size={16} /> Formatted Print Export (one sheet per DDRMS, 8.5×13in Folio)
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default DDRMSPage;
