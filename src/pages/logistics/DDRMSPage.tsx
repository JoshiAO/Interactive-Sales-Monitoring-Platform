import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileSpreadsheet, Plus, Search, Download, Printer, Save, Trash2, ChevronDown, ChevronUp, DollarSign, AlertTriangle, ClipboardPaste, Settings, Eye, Edit3, Check } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/ui/Modal';
import { saveDraft } from '../../utils/indexedDB';
import type { DDRMSHeader, DDRMSInvoice, DDRMSGlobalConfig, DDRMSCollection, RemittanceCheck, DeliverySchedule, LogisticsManning, Picklist } from '../../types/logistics';
import { DELIVERY_STATUS_PRIORITY } from '../../types/logistics';
import QRCode from 'qrcode';

// ─── DDRMS Page Component ───────────────────────────────────────────────────
const DDRMSPage: React.FC = () => {
  const { role, currentUser, name } = useAuth();
  const [ddrmsRecords, setDdrmsRecords] = useState<DDRMSHeader[]>([]);
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [picklists, setPicklists] = useState<Picklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Dynamic Selection Modals
  const [isPlateModalOpen, setIsPlateModalOpen] = useState(false);
  const [plateSearchQuery, setPlateSearchQuery] = useState('');
  const [isSalesmanModalOpen, setIsSalesmanModalOpen] = useState(false);
  const [salesmanSearchQuery, setSalesmanSearchQuery] = useState('');

  // Create DDRMS Modal state
  const [formNumber, setFormNumber] = useState('');
  const [formSalesmanCode, setFormSalesmanCode] = useState('');
  const [formSalesmanName, setFormSalesmanName] = useState('');
  const [formPlate, setFormPlate] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDriver, setFormDriver] = useState('');
  const [formHelpers, setFormHelpers] = useState(0);
  const [formCity, setFormCity] = useState('');
  const [formNoOfPushcart, setFormNoOfPushcart] = useState(0);
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
  const canDelete = role === 'admin';

  const [viewMode, setViewMode] = useState<'edit' | 'read'>(canCreate ? 'edit' : 'read');

  // ─── Real-time listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'logistics_ddrms'), (snap) => {
        const records: DDRMSHeader[] = [];
        snap.forEach((d) => records.push({ id: d.id, ...d.data() } as DDRMSHeader));
        records.sort((a, b) => (b.createdAt || b.deliveryDate).localeCompare(a.createdAt || a.deliveryDate) || b.ddrmsNumber.localeCompare(a.ddrmsNumber));
        setDdrmsRecords(records);
        setLoading(false);
      }),
      onSnapshot(collection(db, 'logistics_schedules'), (snap) => {
        const data: DeliverySchedule[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as DeliverySchedule));
        setSchedules(data);
      }),
      onSnapshot(collection(db, 'logistics_manning'), (snap) => {
        const data: LogisticsManning[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as LogisticsManning));
        setManningRecords(data);
      }),
      onSnapshot(collection(db, 'logistics_picklists'), (snap) => {
        const data: Picklist[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as Picklist));
        setPicklists(data);
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

  // ─── Dynamic Selection Data ────────────────────────────────────────────────
  const availablePlates = useMemo(() => {
    if (!formDate) return [];
    const daySchedules = schedules.filter(s => s.date === formDate);
    const plates = daySchedules.map(s => s.plateNumber);
    const q = plateSearchQuery.toLowerCase();
    return Array.from(new Set(plates)).filter(p => p.toLowerCase().includes(q));
  }, [schedules, formDate, plateSearchQuery]);

  const availableSalesmen = useMemo(() => {
    if (!formPlate || !formDate) return [];
    const schedule = schedules.find(s => s.plateNumber === formPlate && s.date === formDate);
    if (!schedule) return [];

    const pls = picklists.filter(p => schedule.picklistNumbers.includes(p.picklistNumber));
    
    const uniqueSalesmenMap = new Map<string, string>();
    pls.forEach(p => {
      if (p.salesmanCode) {
        uniqueSalesmenMap.set(p.salesmanCode, p.salesmanName || '');
      }
    });

    const results = Array.from(uniqueSalesmenMap.entries()).map(([code, name]) => ({ code, name }));
    const q = salesmanSearchQuery.toLowerCase();
    return results.filter(s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [schedules, picklists, formPlate, formDate, salesmanSearchQuery]);

  const scheduledPicklists = useMemo(() => {
    if (!formPlate || !formDate || !formSalesmanCode) return [];
    const schedule = schedules.find(s => s.plateNumber === formPlate && s.date === formDate);
    if (!schedule) return [];

    return picklists.filter(p => 
      schedule.picklistNumbers.includes(p.picklistNumber) && 
      p.salesmanCode === formSalesmanCode
    );
  }, [schedules, picklists, formPlate, formDate, formSalesmanCode]);

  // ─── Selection Handlers ────────────────────────────────────────────────────
  const handlePlateSelect = (plate: string) => {
    setFormPlate(plate);
    
    const schedule = schedules.find(s => s.plateNumber === plate && s.date === formDate);
    if (schedule) {
      setFormCity(schedule.route);
      setFormHelpers(schedule.helpers.length);
      setFormNoOfPushcart(schedule.noOfPushcart || 0);
    } else {
      setFormCity('');
      setFormHelpers(0);
      setFormNoOfPushcart(0);
    }

    const manning = manningRecords.find(m => m.plateNumber === plate);
    if (manning) {
      setFormDriver(manning.driverName);
    } else {
      setFormDriver('');
    }
    
    // Reset Salesman when plate changes
    setFormSalesmanCode('');
    setFormSalesmanName('');
    setIsPlateModalOpen(false);
  };

  const handleSalesmanSelect = (code: string, name: string) => {
    setFormSalesmanCode(code);
    setFormSalesmanName(name);
    setIsSalesmanModalOpen(false);
  };

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

  // ─── Direct Grid Paste Handler ────────────────────────────────────────────
  const handleGridPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number, startField: keyof DDRMSInvoice) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    
    const lines = text.split('\n').filter(l => l.trim() || l.includes('\t'));
    
    // If it's just a single cell without tabs, let default input behavior handle it
    if (lines.length <= 1 && !text.includes('\t')) return;
    
    e.preventDefault();

    const fieldsOrder: (keyof DDRMSInvoice)[] = [
      'invoiceDate',
      'picklistNumber',
      'systemInvoiceNumber',
      'invoiceNumberSeries',
      'customerCode',
      'customerName',
      'grossAmount'
    ];
    
    const startColIndex = fieldsOrder.indexOf(startField);
    if (startColIndex === -1) return;

    setFormInvoices(prev => {
      const newInvoices = [...prev];
      
      lines.forEach((line, lineOffset) => {
        const cells = line.split('\t');
        const targetRowIndex = startRowIndex + lineOffset;
        
        // If we exceed existing rows, append a new one
        if (targetRowIndex >= newInvoices.length) {
          newInvoices.push({
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
          });
        }
        
        // Fill cells
        cells.forEach((cellValue, cellOffset) => {
          const targetColIndex = startColIndex + cellOffset;
          if (targetColIndex < fieldsOrder.length) {
            const fieldName = fieldsOrder[targetColIndex];
            const cleanValue = cellValue.replace(/\r/g, '').trim();
            
            if (fieldName === 'grossAmount') {
              newInvoices[targetRowIndex][fieldName] = parseFloat(cleanValue) || 0;
            } else {
              // @ts-ignore
              newInvoices[targetRowIndex][fieldName] = cleanValue;
            }
          }
        });
      });
      
      return newInvoices;
    });
  }, [formDate, formCity]);

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
    setFormNoOfPushcart(0);
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
    setFormNoOfPushcart(ddrms.noOfPushcart || 0);
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

      const payload: DDRMSHeader = {
        id: docId,
        ddrmsNumber: formNumber.trim(),
        salesmanCode: formSalesmanCode.trim(),
        salesmanName: formSalesmanName.trim(),
        plateNumber: formPlate.trim(),
        deliveryDate: formDate,
        driverName: formDriver.trim(),
        noOfHelpers: formHelpers,
        noOfPushcart: formNoOfPushcart,
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
      const ExcelJS = (await import('exceljs')).default || await import('exceljs');
      const { saveAs } = await import('file-saver');

      // Filter DDRMS by date range
      let exportRecords = ddrmsRecords;
      if (exportDateFrom) exportRecords = exportRecords.filter((d) => (d.createdAt?.split('T')[0] || d.deliveryDate) >= exportDateFrom);
      if (exportDateTo) exportRecords = exportRecords.filter((d) => (d.createdAt?.split('T')[0] || d.deliveryDate) <= exportDateTo);

      if (exportRecords.length === 0) {
        alert('No DDRMS records found for the selected date range');
        return;
      }

      if (type === 'raw') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('DDRMS Raw Data');
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
        if (rows.length > 0) {
          ws.columns = Object.keys(rows[0]).map(k => ({ header: k, key: k, width: 20 }));
          ws.addRows(rows);
        }
        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `DDRMS_Raw_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx`);
      } else {
        const wb = new ExcelJS.Workbook();
        
        exportRecords.forEach((ddrms) => {
          const invoices = ddrms.invoices || [];
          const pageSize = 25;
          const totalPages = Math.ceil(invoices.length / pageSize) || 1;
          
          const sheetName = ddrms.ddrmsNumber.substring(0, 31);
          const ws = wb.addWorksheet(sheetName, {
            pageSetup: { 
              paperSize: 14 as any, 
              orientation: 'landscape', 
              fitToPage: true, 
              fitToWidth: 1, 
              fitToHeight: 0, 
              margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } 
            }
          });
          
          ws.columns = [
            { width: 4 }, { width: 12 }, { width: 12.43 }, { width: 12.43 }, { width: 12.43 },
            { width: 30 }, { width: 14 }, { width: 6.43 }, { width: 6.43 }, { width: 6.43 },
            { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }
          ];

          for (let page = 0; page < totalPages; page++) {
            const pageInvoices = invoices.slice(page * pageSize, (page + 1) * pageSize);
            const rStart = ws.rowCount;
            
            const bBot = { bottom: { style: 'thin' } as any };
            const bAll = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } as any;
            const hCenter = { horizontal: 'center', vertical: 'middle', wrapText: true } as any;

            const r1 = ws.addRow([ddrms.companyName || globalConfig.companyName || 'Company Name']);
            r1.font = { bold: true, size: 12 };
            ws.mergeCells(rStart + 1, 1, rStart + 1, 7);

            const r2 = ws.addRow([ddrms.divisionTitle || globalConfig.divisionTitle || 'Division']);
            r2.font = { bold: true, size: 11 };
            ws.mergeCells(rStart + 2, 1, rStart + 2, 7);

            const r3 = ws.addRow(['DAILY DELIVERY REMITTANCE MONITORING SHEET', '', '', '', '', '', '', '', '', '', '', 'DDR No. :', ddrms.ddrmsNumber]);
            r3.getCell(1).font = { bold: true, size: 11 };
            r3.getCell(12).font = { bold: true };
            r3.getCell(12).alignment = { horizontal: 'right' };
            r3.getCell(13).border = bBot;
            r3.getCell(14).border = bBot;
            ws.mergeCells(rStart + 3, 1, rStart + 3, 7);
            ws.mergeCells(rStart + 3, 13, rStart + 3, 14);

            const r4 = ws.addRow([
              'Driver/Helpers:', '', `${ddrms.driverName || ''} / ${ddrms.noOfHelpers || 0}`, '', '', '', '',
              'No. of Pushcart:', '', ddrms.noOfPushcart || '', '',
              'Plate No.:', ddrms.plateNumber || '', ''
            ]);
            r4.getCell(1).font = { bold: true };
            ws.mergeCells(rStart + 4, 1, rStart + 4, 2);
            ws.mergeCells(rStart + 4, 3, rStart + 4, 6);
            for(let i=3; i<=6; i++) r4.getCell(i).border = bBot;
            r4.getCell(8).font = { bold: true };
            r4.getCell(8).alignment = { horizontal: 'right' };
            ws.mergeCells(rStart + 4, 8, rStart + 4, 9);
            r4.getCell(10).border = bBot;
            r4.getCell(10).alignment = { horizontal: 'center' };
            ws.mergeCells(rStart + 4, 10, rStart + 4, 11);
            r4.getCell(12).font = { bold: true };
            r4.getCell(12).alignment = { horizontal: 'right' };
            ws.mergeCells(rStart + 4, 13, rStart + 4, 14);
            r4.getCell(13).border = bBot;
            r4.getCell(14).border = bBot;

            const r5 = ws.addRow([
              'Delivery Route:', '', ddrms.routeCity || '', '', '', '', '',
              '', '', '', '',
              'Delivery Date:', ddrms.deliveryDate || '', ''
            ]);
            r5.getCell(1).font = { bold: true };
            ws.mergeCells(rStart + 5, 1, rStart + 5, 2);
            ws.mergeCells(rStart + 5, 3, rStart + 5, 6);
            for(let i=3; i<=6; i++) r5.getCell(i).border = bBot;
            r5.getCell(12).font = { bold: true };
            r5.getCell(12).alignment = { horizontal: 'right' };
            ws.mergeCells(rStart + 5, 13, rStart + 5, 14);
            r5.getCell(13).border = bBot;
            r5.getCell(14).border = bBot;

            ws.addRow([]);

            const h1 = ws.addRow([
              '', 'Invoice Date', 'Picklist Number', 'System Invoice Number', 'Invoice Number',
              'Customer Name', 'Gross Amount', 'QTY', 'QTY', 'QTY',
              'REMITTANCE', '', '', 'Remarks'
            ]);
            const h2 = ws.addRow([
              '', '', '', '', '', '', '', 'CS', 'PC', 'SC',
              'Cash', 'DR', 'Checks', ''
            ]);

            [h1, h2].forEach(row => {
              row.eachCell((c: any) => {
                c.font = { bold: true, size: 10 };
                c.alignment = hCenter;
                c.border = bAll;
              });
            });

            ws.mergeCells(rStart + 7, 1, rStart + 8, 1);
            ws.mergeCells(rStart + 7, 2, rStart + 8, 2);
            ws.mergeCells(rStart + 7, 3, rStart + 8, 3);
            ws.mergeCells(rStart + 7, 4, rStart + 8, 4);
            ws.mergeCells(rStart + 7, 5, rStart + 8, 5);
            ws.mergeCells(rStart + 7, 6, rStart + 8, 6);
            ws.mergeCells(rStart + 7, 7, rStart + 8, 7);
            ws.mergeCells(rStart + 7, 11, rStart + 7, 13);
            ws.mergeCells(rStart + 7, 14, rStart + 8, 14);

            pageInvoices.forEach((inv, idx) => {
              const grossAmt = Number(inv.grossAmount) || 0;
              const csQty = Number(inv.cs) || 0;
              const pcQty = Number(inv.pc) || 0;
              const scQty = Number(inv.sc) || 0;

              const dr = ws.addRow([
                page * pageSize + idx + 1,
                inv.invoiceDate,
                inv.picklistNumber,
                inv.systemInvoiceNumber,
                inv.invoiceNumberSeries,
                inv.customerName,
                grossAmt,
                csQty > 0 ? csQty : '',
                pcQty > 0 ? pcQty : '',
                scQty > 0 ? scQty : '',
                '', '', '',
                inv.remarks || ''
              ]);

              dr.eachCell((c: any) => {
                c.border = bAll;
                c.font = { size: 10 };
              });
              [1, 2, 3, 8, 9, 10].forEach(i => dr.getCell(i).alignment = hCenter);
              dr.getCell(7).alignment = { horizontal: 'right' };
              dr.getCell(7).numFmt = '#,##0.00';
              [8, 9, 10].forEach(i => dr.getCell(i).numFmt = '#,##0');
            });

            const pageTotalGross = pageInvoices.reduce((s, inv) => s + (Number(inv.grossAmount) || 0), 0);
            const pageTotalCS = pageInvoices.reduce((s, inv) => s + (Number(inv.cs) || 0), 0);
            const pageTotalPC = pageInvoices.reduce((s, inv) => s + (Number(inv.pc) || 0), 0);
            const pageTotalSC = pageInvoices.reduce((s, inv) => s + (Number(inv.sc) || 0), 0);

            const rStartNum = rStart + 9;
            const rEndNum = Math.max(rStartNum, rStart + 8 + pageInvoices.length);

            const tr = ws.addRow([
              '', '', '', '', '', 'TOTAL',
              { formula: `SUBTOTAL(9, G${rStartNum}:G${rEndNum})`, result: pageTotalGross },
              { formula: `SUBTOTAL(9, H${rStartNum}:H${rEndNum})`, result: pageTotalCS > 0 ? pageTotalCS : '' },
              { formula: `SUBTOTAL(9, I${rStartNum}:I${rEndNum})`, result: pageTotalPC > 0 ? pageTotalPC : '' },
              { formula: `SUBTOTAL(9, J${rStartNum}:J${rEndNum})`, result: pageTotalSC > 0 ? pageTotalSC : '' },
              '', '', '', ''
            ]);
            tr.eachCell((c: any) => { c.border = bAll; });
            tr.getCell(6).font = { bold: true };
            tr.getCell(7).font = { bold: true };
            tr.getCell(7).alignment = { horizontal: 'right' };
            tr.getCell(7).numFmt = '#,##0.00';
            [8, 9, 10].forEach(i => {
              tr.getCell(i).font = { bold: true };
              tr.getCell(i).alignment = hCenter;
              tr.getCell(i).numFmt = '#,##0';
            });

            ws.addRow([]);

            const sigL = ws.addRow(['Released by:', '', '', '', '', '', 'Submitted by:', '', '', '', '', 'Checked By:', '', '']);
            [1, 7, 12].forEach(i => sigL.getCell(i).font = { bold: true });
            const sRow = ws.rowCount;
            ws.mergeCells(sRow, 1, sRow, 2);
            ws.mergeCells(sRow, 7, sRow, 8);
            ws.mergeCells(sRow, 12, sRow, 14);

            ws.addRow([]);

            const sigN = ws.addRow([
              ddrms.encoderName || '', '', '', '', '', '',
              ddrms.driverName || '', '', '', '', '',
              ddrms.officerInChargeCashierName || globalConfig.officerInChargeCashierName || '', '', ''
            ]);
            const snRow = ws.rowCount;
            [1, 7, 12].forEach(i => sigN.getCell(i).alignment = { horizontal: 'center' });
            ws.mergeCells(snRow, 1, snRow, 4);
            ws.mergeCells(snRow, 7, snRow, 10);
            ws.mergeCells(snRow, 12, snRow, 14);

            const sigT = ws.addRow([
              'Office Staff Name & Signature', '', '', '', '', '',
              'Delivery Driver Name & Signature', '', '', '', '',
              'Officer In-charge / Cashier', '', ''
            ]);
            const stRow = ws.rowCount;
            const sLab = { font: { bold: true }, alignment: { horizontal: 'center' }, border: { top: { style: 'thin' } } } as any;
            
            sigT.getCell(1).style = sLab;
            sigT.getCell(2).border = { top: { style: 'thin' } };
            sigT.getCell(3).border = { top: { style: 'thin' } };
            sigT.getCell(4).border = { top: { style: 'thin' } };
            
            sigT.getCell(7).style = sLab;
            sigT.getCell(8).border = { top: { style: 'thin' } };
            sigT.getCell(9).border = { top: { style: 'thin' } };
            sigT.getCell(10).border = { top: { style: 'thin' } };

            sigT.getCell(12).style = sLab;
            sigT.getCell(13).border = { top: { style: 'thin' } };
            sigT.getCell(14).border = { top: { style: 'thin' } };

            ws.mergeCells(stRow, 1, stRow, 4);
            ws.mergeCells(stRow, 7, stRow, 10);
            ws.mergeCells(stRow, 12, stRow, 14);

            if (totalPages > 1) {
              ws.addRow([]);
              ws.addRow([`Page ${page + 1} of ${totalPages}`]);
            }
            ws.addRow([]);
          }
        });

        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `DDRMS_Formatted_${exportDateFrom || 'all'}_to_${exportDateTo || 'all'}.xlsx`);
      }
      setShowExportModal(false);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
    }
  };

  // ─── Browser Print directly ───────────────────────────────────────────────
  const handlePrintDDRMS = async (ddrms: DDRMSHeader) => {
    const invoices = ddrms.invoices || [];
    const pageSize = 25;
    const totalPages = Math.ceil(invoices.length / pageSize) || 1;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(ddrms.id, { margin: 0, width: 100 });
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }

    let pagesHtml = '';

    for (let page = 0; page < totalPages; page++) {
      const pageInvoices = invoices.slice(page * pageSize, (page + 1) * pageSize);
      
      const pageTotalGross = pageInvoices.reduce((s, inv) => s + (Number(inv.grossAmount) || 0), 0);
      const pageTotalCS = pageInvoices.reduce((s, inv) => s + (Number(inv.cs) || 0), 0);
      const pageTotalPC = pageInvoices.reduce((s, inv) => s + (Number(inv.pc) || 0), 0);
      const pageTotalSC = pageInvoices.reduce((s, inv) => s + (Number(inv.sc) || 0), 0);

      const rowsHtml = pageInvoices.map((inv, idx) => {
        const grossAmt = Number(inv.grossAmount) || 0;
        const csQty = Number(inv.cs) || 0;
        const pcQty = Number(inv.pc) || 0;
        const scQty = Number(inv.sc) || 0;
        return `
          <tr>
            <td class="bAll center">${page * pageSize + idx + 1}</td>
            <td class="bAll center">${inv.invoiceDate}</td>
            <td class="bAll center">${inv.picklistNumber}</td>
            <td class="bAll">${inv.systemInvoiceNumber}</td>
            <td class="bAll">${inv.invoiceNumberSeries}</td>
            <td class="bAll">${inv.customerName}</td>
            <td class="bAll right">${grossAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="bAll center">${csQty > 0 ? csQty : ''}</td>
            <td class="bAll center">${pcQty > 0 ? pcQty : ''}</td>
            <td class="bAll center">${scQty > 0 ? scQty : ''}</td>
            <td class="bAll"></td>
            <td class="bAll"></td>
            <td class="bAll"></td>
            <td class="bAll">${inv.remarks || ''}</td>
          </tr>
        `;
      }).join('');

      pagesHtml += `
        <div class="page">
          <div style="font-weight: bold; font-size: 14pt;">${ddrms.companyName || globalConfig.companyName || 'Company Name'}</div>
          <div style="font-weight: bold; font-size: 11pt;">${ddrms.divisionTitle || globalConfig.divisionTitle || 'Division'}</div>
          
          <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 9pt; text-align: left; margin-top: 10px; table-layout: fixed;">
            <colgroup>
              <col style="width: 2.3%;"> <!-- Seq -->
              <col style="width: 7.0%;"> <!-- Inv Date -->
              <col style="width: 7.2%;"> <!-- Picklist Number -->
              <col style="width: 7.2%;"> <!-- System Invoice Number -->
              <col style="width: 7.2%;"> <!-- Invoice Number -->
              <col style="width: 17.4%;"> <!-- Customer Name -->
              <col style="width: 8.1%;"> <!-- Gross Amount -->
              <col style="width: 3.7%;"> <!-- CS -->
              <col style="width: 3.7%;"> <!-- PC -->
              <col style="width: 3.7%;"> <!-- SC -->
              <col style="width: 7.0%;"> <!-- Cash -->
              <col style="width: 7.0%;"> <!-- DR -->
              <col style="width: 7.0%;"> <!-- Checks -->
              <col style="width: 11.6%;"> <!-- Remarks -->
            </colgroup>
            
            <tr>
              <td colspan="7" style="font-weight: bold; font-size: 12pt;">DAILY DELIVERY REMITTANCE MONITORING SHEET</td>
              <td colspan="4"></td>
              <td style="font-weight: bold; text-align: right; white-space: nowrap;">DDR No. :</td>
              <td colspan="2" class="bBot">${ddrms.ddrmsNumber}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold;">Driver/Helpers:</td>
              <td colspan="4" class="bBot">${ddrms.driverName || ''} / ${ddrms.noOfHelpers || 0}</td>
              <td></td>
              <td colspan="2" style="font-weight: bold; text-align: right; white-space: nowrap;">No. of Pushcart:</td>
              <td colspan="2" class="bBot center">${ddrms.noOfPushcart || ''}</td>
              <td style="font-weight: bold; text-align: right; white-space: nowrap;">Plate No.:</td>
              <td colspan="2" class="bBot">${ddrms.plateNumber || ''}</td>
            </tr>
            <tr>
              <td colspan="2" style="font-weight: bold;">Delivery Route:</td>
              <td colspan="4" class="bBot">${ddrms.routeCity || ''}</td>
              <td colspan="5"></td>
              <td style="font-weight: bold; text-align: right; white-space: nowrap;">Delivery Date:</td>
              <td colspan="2" class="bBot">${ddrms.deliveryDate || ''}</td>
            </tr>
            <tr><td colspan="14" style="height: 10px;"></td></tr>

            <tr>
              <th rowspan="2" class="bAll"></th>
              <th rowspan="2" class="bAll">Invoice Date</th>
              <th rowspan="2" class="bAll">Picklist Number</th>
              <th rowspan="2" class="bAll">System Invoice Number</th>
              <th rowspan="2" class="bAll">Invoice Number</th>
              <th rowspan="2" class="bAll">Customer Name</th>
              <th rowspan="2" class="bAll">Gross Amount</th>
              <th colspan="3" class="bAll center">QTY</th>
              <th colspan="3" class="bAll center">REMITTANCE</th>
              <th rowspan="2" class="bAll">Remarks</th>
            </tr>
            <tr>
              <th class="bAll">CS</th>
              <th class="bAll">PC</th>
              <th class="bAll">SC</th>
              <th class="bAll">Cash</th>
              <th class="bAll">DR</th>
              <th class="bAll">Checks</th>
            </tr>

            ${rowsHtml}

            <tr>
              <td colspan="5"></td>
              <td class="bAll" style="font-weight: bold;">TOTAL</td>
              <td class="bAll right" style="font-weight: bold;">${pageTotalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="bAll center" style="font-weight: bold;">${pageTotalCS > 0 ? pageTotalCS : ''}</td>
              <td class="bAll center" style="font-weight: bold;">${pageTotalPC > 0 ? pageTotalPC : ''}</td>
              <td class="bAll center" style="font-weight: bold;">${pageTotalSC > 0 ? pageTotalSC : ''}</td>
              <td class="bAll"></td>
              <td class="bAll"></td>
              <td class="bAll"></td>
              <td class="bAll"></td>
            </tr>
          </table>

          <table style="width: 100%; font-size: 9pt; text-align: center; font-family: sans-serif; table-layout: fixed; margin-top: 20px;">
            <tr>
              <td colspan="2" style="font-weight: bold; text-align: left;">Released by:</td>
              <td colspan="4"></td>
              <td colspan="2" style="font-weight: bold; text-align: left;">Submitted by:</td>
              <td colspan="3"></td>
              <td colspan="2" style="font-weight: bold; text-align: left;">Checked By:</td>
              <td></td>
            </tr>
            <tr><td colspan="14" style="height: 25px;"></td></tr>
            <tr>
              <td colspan="4">${ddrms.encoderName || ''}</td>
              <td colspan="2"></td>
              <td colspan="4">${ddrms.driverName || ''}</td>
              <td></td>
              <td colspan="3">${ddrms.officerInChargeCashierName || globalConfig.officerInChargeCashierName || ''}</td>
            </tr>
            <tr>
              <td colspan="4" style="border-top: 1px solid black; font-weight: bold;">Office Staff Name & Signature</td>
              <td colspan="2"></td>
              <td colspan="4" style="border-top: 1px solid black; font-weight: bold;">Delivery Driver Name & Signature</td>
              <td></td>
              <td colspan="3" style="border-top: 1px solid black; font-weight: bold;">Officer In-charge / Cashier</td>
            </tr>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px;">
            <div style="text-align: center;">
              ${qrDataUrl ? `<img src="${qrDataUrl}" style="width: 70px; height: 70px; margin-bottom: 4px;" alt="QR Code" />` : ''}
              <div style="font-size: 8pt; font-family: monospace; color: #555;">SCAN FOR DISPATCH</div>
            </div>
            ${totalPages > 1 ? `<div style="font-size: 9pt; font-family: sans-serif;">Page ${page + 1} of ${totalPages}</div>` : '<div></div>'}
          </div>
        </div>
      `;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print DDRMS - ${ddrms.ddrmsNumber}</title>
          <style>
            @page {
              size: 8.5in 13in landscape; /* Folio */
              margin: 0.5in 0.25in 0.5in 0.25in;
            }
            body { font-family: sans-serif; font-size: 9pt; margin: 0; padding: 0; }
            .page { page-break-after: always; padding: 0.25in; box-sizing: border-box; }
            .bAll { border: 1px solid black; padding: 3px 4px; }
            .bBot { border-bottom: 1px solid black; padding-bottom: 2px; }
            .center { text-align: center; }
            .right { text-align: right; }
            th { font-weight: bold; background-color: #fcfcfc; }
          </style>
        </head>
        <body>
          ${pagesHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
        /* EDIT VIEW 60/40 Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '24px', flex: 1, minHeight: 0 }}>
          {/* LEFT 60% Form */}
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingDDRMS ? 'Edit DDRMS' : 'Create New DDRMS'}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {editingDDRMS && (
                  <button 
                    onClick={() => {
                      const tempDDRMS = {
                        ...editingDDRMS,
                        ddrmsNumber: formNumber,
                        deliveryDate: formDate,
                        salesmanCode: formSalesmanCode,
                        salesmanName: formSalesmanName,
                        driverName: formDriver,
                        noOfHelpers: formHelpers,
                        plateNumber: formPlate,
                        routeCity: formCity,
                        invoices: formInvoices
                      };
                      handlePrintDDRMS(tempDDRMS as any);
                    }}
                    className="btn" 
                    style={{ fontSize: '13px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                  >
                    <Printer size={14} /> Print
                  </button>
                )}
                {editingDDRMS && (
                  <button onClick={handleOpenCreate} className="btn" style={{ fontSize: '13px' }}>
                    <Plus size={14} /> New Entry
                  </button>
                )}
              </div>
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
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Salesman Selection *</label>
                  <button
                    type="button"
                    onClick={() => setIsSalesmanModalOpen(true)}
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: formSalesmanCode ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {formSalesmanCode ? `${formSalesmanCode} - ${formSalesmanName}` : 'Select Salesman...'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Plate Number *</label>
                  <button
                    type="button"
                    onClick={() => setIsPlateModalOpen(true)}
                    className="btn"
                    style={{
                      width: '100%',
                      justifyContent: 'flex-start',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: formPlate ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {formPlate || 'Select Plate...'}
                  </button>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>Driver Name <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>(Auto)</span></label>
                  <input type="text" value={formDriver} readOnly style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>No. of Helpers <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>(Auto)</span></label>
                  <input type="number" value={formHelpers} readOnly style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>Route / City <span style={{ fontSize: '10px', color: 'var(--accent-primary)' }}>(Auto)</span></label>
                  <input type="text" value={formCity} readOnly style={{ width: '100%', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Scheduled Picklists */}
              {scheduledPicklists.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <h4 style={{ fontSize: '13px', margin: '0 0 8px 0', color: 'var(--text-muted)' }}>Scheduled Picklists for {formSalesmanName}</h4>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {scheduledPicklists.map(pl => (
                      <div
                        key={pl.id}
                        onClick={() => {
                          setFormInvoices(prev => [
                            ...prev,
                            {
                              id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                              invoiceDate: formDate || '',
                              picklistNumber: pl.picklistNumber,
                              systemInvoiceNumber: '',
                              invoiceNumberSeries: '',
                              customerCode: '',
                              customerName: '',
                              barangay: '',
                              city: pl.city || '',
                              province: '',
                              grossAmount: 0,
                              cs: 0,
                              pc: 0,
                              sc: 0,
                              deliveryStatus: 'Pending',
                              updatedAt: new Date().toISOString(),
                            }
                          ]);
                        }}
                        style={{
                          minWidth: '200px',
                          padding: '12px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', marginBottom: '4px' }}>📋 {pl.picklistNumber}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>City: {pl.city || 'N/A'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CS: {pl.cs || 0} | Acc: {pl.numberOfAccounts || 0}</div>
                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>+ Add Invoice Row</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                          {['#', 'Date', 'PL#', 'Sys Inv#', 'Booklet Series', 'Cust Code', 'Cust Name', 'Amount', 'CS', 'PC', 'SC', ''].map((h) => (
                            <th key={h} style={{ padding: '6px 4px', textAlign: 'left', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {formInvoices.map((inv, i) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '4px', color: 'var(--text-muted)', width: '30px' }}>{i + 1}</td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.invoiceDate} onChange={(e) => handleUpdateInvoice(i, 'invoiceDate', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'invoiceDate')} style={{ padding: '4px 6px', fontSize: '12px', width: '90px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.picklistNumber} onChange={(e) => handleUpdateInvoice(i, 'picklistNumber', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'picklistNumber')} style={{ padding: '4px 6px', fontSize: '12px', width: '70px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.systemInvoiceNumber} onChange={(e) => handleUpdateInvoice(i, 'systemInvoiceNumber', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'systemInvoiceNumber')} style={{ padding: '4px 6px', fontSize: '12px', width: '100px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.invoiceNumberSeries} onChange={(e) => handleUpdateInvoice(i, 'invoiceNumberSeries', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'invoiceNumberSeries')} style={{ padding: '4px 6px', fontSize: '12px', width: '120px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.customerCode} onChange={(e) => handleUpdateInvoice(i, 'customerCode', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'customerCode')} style={{ padding: '4px 6px', fontSize: '12px', width: '80px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="text" value={inv.customerName} onChange={(e) => handleUpdateInvoice(i, 'customerName', e.target.value)} onPaste={(e) => handleGridPaste(e, i, 'customerName')} style={{ padding: '4px 6px', fontSize: '12px', width: '140px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="number" value={inv.grossAmount} onChange={(e) => handleUpdateInvoice(i, 'grossAmount', parseFloat(e.target.value) || 0)} onPaste={(e) => handleGridPaste(e, i, 'grossAmount')} style={{ padding: '4px 6px', fontSize: '12px', width: '90px' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="number" value={inv.cs || ''} onChange={(e) => handleUpdateInvoice(i, 'cs', parseFloat(e.target.value) || 0)} onPaste={(e) => handleGridPaste(e, i, 'cs')} style={{ padding: '4px 6px', fontSize: '12px', width: '50px', textAlign: 'center' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="number" value={inv.pc || ''} onChange={(e) => handleUpdateInvoice(i, 'pc', parseFloat(e.target.value) || 0)} onPaste={(e) => handleGridPaste(e, i, 'pc')} style={{ padding: '4px 6px', fontSize: '12px', width: '50px', textAlign: 'center' }} />
                            </td>
                            <td style={{ padding: '4px' }}>
                              <input type="number" value={inv.sc || ''} onChange={(e) => handleUpdateInvoice(i, 'sc', parseFloat(e.target.value) || 0)} onPaste={(e) => handleGridPaste(e, i, 'sc')} style={{ padding: '4px 6px', fontSize: '12px', width: '50px', textAlign: 'center' }} />
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
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', alignItems: 'center' }}>
                    <span>Total Invoices: <strong>{formInvoices.length}</strong></span>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <span>CS: <strong>{formInvoices.reduce((s, i) => s + (i.cs || 0), 0)}</strong></span>
                      <span>PC: <strong>{formInvoices.reduce((s, i) => s + (i.pc || 0), 0)}</strong></span>
                      <span>SC: <strong>{formInvoices.reduce((s, i) => s + (i.sc || 0), 0)}</strong></span>
                      <span>Amount: <strong style={{ color: 'var(--accent-success)' }}>₱{formInvoices.reduce((s, i) => s + i.grossAmount, 0).toLocaleString()}</strong></span>
                    </div>
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
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePrintDDRMS(ddrms); }}
                            className="btn-icon"
                            style={{ width: '24px', height: '24px', color: 'var(--text-muted)' }}
                            title="Print DDRMS directly"
                          >
                            <Printer size={12} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(ddrms.id); }}
                              className="btn-icon"
                              style={{ width: '24px', height: '24px' }}
                            >
                              <Trash2 size={12} color="var(--accent-danger)" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Created: {ddrms.createdAt?.split('T')[0] || ddrms.deliveryDate}
                      </div>
                      
                      <div style={{ marginTop: '8px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>SM:</span> {ddrms.salesmanName}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Delivery:</span> {ddrms.deliveryDate}
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
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Created: {ddrms.createdAt?.split('T')[0] || ddrms.deliveryDate} <br />
                          Delivery: {ddrms.deliveryDate}
                        </div>
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

      {/* Plate Selection Modal */}
      <Modal
        isOpen={isPlateModalOpen}
        onClose={() => setIsPlateModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Select Scheduled Plate Number</span>
          </div>
        }
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by Plate Number..."
              value={plateSearchQuery}
              onChange={(e) => setPlateSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px', background: 'var(--bg-panel)' }}
              autoFocus
            />
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availablePlates.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No active schedules found for {formDate}.
              </div>
            ) : (
              availablePlates.map((plate) => (
                <div
                  key={plate}
                  onClick={() => handlePlateSelect(plate)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: formPlate === plate ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-panel)',
                    border: `1px solid ${formPlate === plate ? 'var(--accent-primary)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontWeight: 600, color: formPlate === plate ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {plate}
                  </span>
                  {formPlate === plate && <Check size={16} color="var(--accent-primary)" />}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Salesman Selection Modal */}
      <Modal
        isOpen={isSalesmanModalOpen}
        onClose={() => setIsSalesmanModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Select Scheduled Salesman</span>
          </div>
        }
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!formPlate ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--accent-warning)', fontSize: '13px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px' }}>
              Please select a Plate Number first to see its scheduled salesmen.
            </div>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by Code or Name..."
                  value={salesmanSearchQuery}
                  onChange={(e) => setSalesmanSearchQuery(e.target.value)}
                  style={{ width: '100%', paddingLeft: '36px', background: 'var(--bg-panel)' }}
                  autoFocus
                />
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableSalesmen.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No salesmen scheduled for plate {formPlate}.
                  </div>
                ) : (
                  availableSalesmen.map((salesman) => (
                    <div
                      key={salesman.code}
                      onClick={() => handleSalesmanSelect(salesman.code, salesman.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: formSalesmanCode === salesman.code ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-panel)',
                        border: `1px solid ${formSalesmanCode === salesman.code ? 'var(--accent-primary)' : 'var(--border)'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 600, color: formSalesmanCode === salesman.code ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {salesman.name || 'Unknown Name'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Code: {salesman.code}
                        </span>
                      </div>
                      {formSalesmanCode === salesman.code && <Check size={16} color="var(--accent-primary)" />}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default DDRMSPage;
