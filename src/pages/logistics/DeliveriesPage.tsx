import React, { useState, useEffect, useMemo } from 'react';
import { Package, CheckCircle, XCircle, AlertTriangle, Search, Clock, Truck, Users, LayoutGrid, List, ScanLine } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/ui/Modal';
import type { DDRMSHeader, DDRMSInvoice, DeliveryStatus, NotDeliveredReason, LogisticsManning } from '../../types/logistics';
import { DELIVERY_STATUS_PRIORITY, NOT_DELIVERED_REASONS } from '../../types/logistics';
import { Html5QrcodeScanner } from 'html5-qrcode';

const DeliveriesPage: React.FC = () => {
  const { role, currentUser, name, salesmanId, team } = useAuth();
  const [ddrmsRecords, setDdrmsRecords] = useState<DDRMSHeader[]>([]);
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [teamSalesmenCodes, setTeamSalesmenCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'invoices'>('invoices');
  const [selectedTeamPlate, setSelectedTeamPlate] = useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] = useState<{ ddrmsId: string; invoice: DDRMSInvoice } | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<DeliveryStatus>('Delivered');
  const [confirmReason, setConfirmReason] = useState<NotDeliveredReason | ''>('');
  const [confirmRemarks, setConfirmRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const isDeliveryTeam = role === 'delivery_team';
  const canConfirm = role === 'delivery_team' || role === 'admin' || role === 'warehouse_supervisor';

  // Listeners
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'logistics_ddrms'), (snap) => {
        const records: DDRMSHeader[] = [];
        snap.forEach((d) => {
          records.push({ id: d.id, ...d.data() } as DDRMSHeader);
        });
        setDdrmsRecords(records);
        setLoading(false);
      }),
      onSnapshot(collection(db, 'logistics_manning'), (snap) => {
        const records: LogisticsManning[] = [];
        snap.forEach((d) => {
          records.push({ id: d.id, ...d.data() } as LogisticsManning);
        });
        setManningRecords(records);
      }),
    ];

    if (role === 'supervisor' && team) {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        const codes: string[] = [];
        snap.forEach((d) => {
          const u = d.data();
          if (u.team === team && u.salesmanId) {
            codes.push(u.salesmanId);
          }
        });
        setTeamSalesmenCodes(codes);
      });
      unsubs.push(unsubUsers);
    }

    return () => unsubs.forEach((u) => u());
  }, [role, team]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('qr-reader', { 
        fps: 10, 
        qrbox: { width: 230, height: 230 },
        videoConstraints: { facingMode: { ideal: "environment" } }
      }, false);

      scanner.render((decodedText) => {
        handleScanDDRMS(decodedText);
        scanner.clear();
        setShowScanner(false);
      }, (_err) => {
        // ignore errors to prevent console spam
      });

      // Inject tactical overlay directly into scan region
      const observer = new MutationObserver(() => {
        const scanRegion = document.getElementById('qr-reader__scan_region');
        if (scanRegion && !document.getElementById('tactical-overlay-injected')) {
          scanRegion.style.position = 'relative';
          const overlay = document.createElement('div');
          overlay.id = 'tactical-overlay-injected';
          overlay.className = 'tactical-overlay';
          overlay.innerHTML = `
            <div class="tactical-scan-box">
              <div class="tactical-corner tactical-corner-tl"></div>
              <div class="tactical-corner tactical-corner-tr"></div>
              <div class="tactical-corner tactical-corner-bl"></div>
              <div class="tactical-corner tactical-corner-br"></div>
              <div class="tactical-laser-line"></div>
              <div class="tactical-crosshair-center"></div>
            </div>
          `;
          scanRegion.appendChild(overlay);
        }
      });
      
      const qrReaderElement = document.getElementById('qr-reader');
      if (qrReaderElement) {
        observer.observe(qrReaderElement, { childList: true, subtree: true });
      }

      return () => {
        observer.disconnect();
        scanner.clear().catch(console.error);
      };
    }
  }, [showScanner]);

  const handleScanDDRMS = async (ddrmsId: string) => {
    try {
      const docRef = doc(db, 'logistics_ddrms', ddrmsId);
      const snap = ddrmsRecords.find(d => d.id === ddrmsId);
      if (!snap) {
        alert('DDRMS not found in current records. It might be archived or invalid.');
        return;
      }
      
      await updateDoc(docRef, {
        status: 'On The Way',
        qrScanTime: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert(`DDRMS #${snap.ddrmsNumber} successfully scanned and is now On Delivery!`);
    } catch (err: any) {
      console.error(err);
      alert('Failed to scan DDRMS: ' + err.message);
    }
  };

  // Role-filtered DDRMS headers
  const filteredDdrmsRecords = useMemo(() => {
    return ddrmsRecords.filter((ddrms) => {
      // Must be scanned to show in Deliveries Management
      const isScanned = !!ddrms.qrScanTime || ['On The Way', 'Delivered', 'Remitted'].includes(ddrms.status);
      if (!isScanned) return false;

      if (role === 'admin' || role === 'warehouse_supervisor' || role === 'manager') {
        return true;
      }
      if (role === 'delivery_team') {
        const plateFromEmail = currentUser?.email ? currentUser.email.split('@')[0]?.toUpperCase() : '';
        return (
          ddrms.plateNumber.toUpperCase() === plateFromEmail ||
          (ddrms.driverName && name && ddrms.driverName.toLowerCase().includes(name.toLowerCase()))
        );
      }
      if (role === 'encoder') {
        return ddrms.encoderId === currentUser?.uid || ddrms.encoderName === name;
      }
      if (role === 'salesman') {
        return (
          ddrms.salesmanCode === salesmanId ||
          (salesmanId && ddrms.salesmanCode.toLowerCase() === salesmanId.toLowerCase()) ||
          (name && ddrms.salesmanName.toLowerCase() === name.toLowerCase())
        );
      }
      if (role === 'supervisor') {
        if (teamSalesmenCodes.length > 0) {
          return teamSalesmenCodes.includes(ddrms.salesmanCode);
        }
        return true;
      }
      return true;
    });
  }, [ddrmsRecords, role, currentUser, name, salesmanId, teamSalesmenCodes]);

  // Delivery Team Cards Data
  const deliveryTeamCards = useMemo(() => {
    // Collect all unique plates from Manning + DDRMS
    const plateMap = new Map<string, {
      plateNumber: string;
      driverName: string;
      helpers: string[];
      vehicleType: string;
      assignedDdrms: DDRMSHeader[];
      totalInvoices: number;
      deliveredCount: number;
      pendingCount: number;
      notDeliveredCount: number;
      totalGross: number;
    }>();

    // First populate from Manning records
    manningRecords.forEach((m) => {
      plateMap.set(m.plateNumber.toUpperCase(), {
        plateNumber: m.plateNumber,
        driverName: m.driverName,
        helpers: m.helpers,
        vehicleType: m.vehicleType,
        assignedDdrms: [],
        totalInvoices: 0,
        deliveredCount: 0,
        pendingCount: 0,
        notDeliveredCount: 0,
        totalGross: 0,
      });
    });

    // Populate DDRMS data into plateMap
    filteredDdrmsRecords.forEach((ddrms) => {
      const plateKey = (ddrms.plateNumber || 'UNASSIGNED').toUpperCase();
      if (!plateMap.has(plateKey)) {
        plateMap.set(plateKey, {
          plateNumber: ddrms.plateNumber || 'Unassigned',
          driverName: ddrms.driverName || 'N/A',
          helpers: [],
          vehicleType: 'Elf',
          assignedDdrms: [],
          totalInvoices: 0,
          deliveredCount: 0,
          pendingCount: 0,
          notDeliveredCount: 0,
          totalGross: 0,
        });
      }

      const teamData = plateMap.get(plateKey)!;
      teamData.assignedDdrms.push(ddrms);
      teamData.totalGross += ddrms.totalGrossAmount || 0;

      (ddrms.invoices || []).forEach((inv) => {
        teamData.totalInvoices++;
        if (inv.deliveryStatus === 'Delivered') teamData.deliveredCount++;
        else if (inv.deliveryStatus === 'Not Delivered') teamData.notDeliveredCount++;
        else teamData.pendingCount++;
      });
    });

    return Array.from(plateMap.values());
  }, [manningRecords, filteredDdrmsRecords]);

  // Flatten all invoices for display
  const allInvoices = useMemo(() => {
    const invoices: Array<{ ddrmsId: string; ddrmsNumber: string; plateNumber: string; invoice: DDRMSInvoice }> = [];

    filteredDdrmsRecords.forEach((ddrms) => {
      if (!ddrms.invoices) return;
      if (selectedTeamPlate && ddrms.plateNumber.toUpperCase() !== selectedTeamPlate.toUpperCase()) return;

      ddrms.invoices.forEach((inv) => {
        invoices.push({
          ddrmsId: ddrms.id,
          ddrmsNumber: ddrms.ddrmsNumber,
          plateNumber: ddrms.plateNumber,
          invoice: inv,
        });
      });
    });

    // Filter by status
    let filtered = invoices;
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.invoice.deliveryStatus === statusFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.invoice.customerName.toLowerCase().includes(q) ||
          i.invoice.customerCode.toLowerCase().includes(q) ||
          i.invoice.systemInvoiceNumber.toLowerCase().includes(q) ||
          i.invoice.city.toLowerCase().includes(q) ||
          i.ddrmsNumber.toLowerCase().includes(q)
      );
    }

    // Sort: Not Delivered pinned at top, then by DDRMS number
    filtered.sort((a, b) => {
      const pa = DELIVERY_STATUS_PRIORITY[a.invoice.deliveryStatus] ?? 99;
      const pb = DELIVERY_STATUS_PRIORITY[b.invoice.deliveryStatus] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.ddrmsNumber.localeCompare(b.ddrmsNumber);
    });

    return filtered;
  }, [filteredDdrmsRecords, selectedTeamPlate, statusFilter, searchQuery]);

  const handleOpenConfirm = (ddrmsId: string, invoice: DDRMSInvoice) => {
    setSelectedInvoice({ ddrmsId, invoice });
    setConfirmStatus(invoice.deliveryStatus === 'Pending' ? 'Delivered' : invoice.deliveryStatus);
    setConfirmReason((invoice.notDeliveredReason as NotDeliveredReason) || '');
    setConfirmRemarks(invoice.remarks || '');
  };

  const handleConfirmDelivery = async () => {
    if (!selectedInvoice) return;
    if (confirmStatus === 'Not Delivered' && !confirmReason) {
      alert('Please select a reason for Not Delivered');
      return;
    }
    setSaving(true);
    try {
      const ddrmsRef = doc(db, 'logistics_ddrms', selectedInvoice.ddrmsId);
      const ddrms = ddrmsRecords.find((d) => d.id === selectedInvoice.ddrmsId);
      if (!ddrms) throw new Error('DDRMS record not found');

      const updatedInvoices = ddrms.invoices.map((inv) => {
        if (inv.id === selectedInvoice.invoice.id) {
          const newInv = {
            ...inv,
            deliveryStatus: confirmStatus,
            updatedAt: new Date().toISOString(),
          };

          if (confirmStatus === 'Not Delivered') {
            newInv.notDeliveredReason = confirmReason as NotDeliveredReason;
          } else {
            delete newInv.notDeliveredReason;
          }

          if (confirmRemarks.trim()) {
            newInv.remarks = confirmRemarks.trim();
          } else {
            delete newInv.remarks;
          }

          return newInv;
        }
        return inv;
      });

      const allSettled = updatedInvoices.every((inv) => inv.deliveryStatus !== 'Pending');
      const headerStatus = allSettled ? 'Delivered' : ddrms.status;

      await updateDoc(ddrmsRef, {
        invoices: updatedInvoices,
        status: headerStatus,
        updatedAt: new Date().toISOString(),
      });

      setSelectedInvoice(null);
    } catch (err: any) {
      console.error('Error confirming delivery:', err);
      alert('Failed to update: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'Delivered':
        return { icon: <CheckCircle size={14} />, bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Delivered' };
      case 'Not Delivered':
        return { icon: <XCircle size={14} />, bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: '🚨 NOT DELIVERED' };
      case 'Rescheduled':
        return { icon: <Clock size={14} />, bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)', label: 'Rescheduled' };
      default:
        return { icon: <Clock size={14} />, bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'Pending' };
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { all: 0, Pending: 0, Delivered: 0, 'Not Delivered': 0 };
    filteredDdrmsRecords.forEach((ddrms) => {
      if (!ddrms.invoices) return;
      ddrms.invoices.forEach((inv) => {
        counts.all++;
        counts[inv.deliveryStatus as keyof typeof counts]++;
      });
    });
    return counts;
  }, [filteredDdrmsRecords]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={24} style={{ color: 'var(--accent-primary)' }} />
            Deliveries Management
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            {isDeliveryTeam ? 'Confirm delivery status for your assigned invoices' : 'Monitor delivery status and teams'}
          </p>
        </div>

        {(role === 'warehouse_supervisor' || role === 'manager' || role === 'admin') && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowScanner(true)}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '6px 14px' }}
            >
              <ScanLine size={16} /> Scan DDRMS
            </button>
            <div style={{ display: 'flex', background: 'var(--bg-panel)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => { setViewMode('cards'); setSelectedTeamPlate(null); }}
                className="btn"
                style={{
                  background: viewMode === 'cards' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'cards' ? 'white' : 'var(--text-muted)',
                  border: 'none', padding: '6px 12px', fontSize: '13px',
                }}
              >
                <LayoutGrid size={16} /> Delivery Team Cards
              </button>
              <button
                onClick={() => setViewMode('invoices')}
                className="btn"
                style={{
                  background: viewMode === 'invoices' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'invoices' ? 'white' : 'var(--text-muted)',
                  border: 'none', padding: '6px 12px', fontSize: '13px',
                }}
              >
                <List size={16} /> Invoice List
              </button>
            </div>
          </div>
        )}
        {role === 'delivery_team' && (
          <button
            onClick={() => setShowScanner(true)}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '6px 14px' }}
          >
            <ScanLine size={16} /> Scan DDRMS
          </button>
        )}
      </div>

      {/* VIEW 1: DELIVERY TEAM CARDS (For Warehouse Supervisor, Manager, Admin) */}
      {viewMode === 'cards' && (role === 'warehouse_supervisor' || role === 'manager' || role === 'admin') ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Delivery Teams Summary ({deliveryTeamCards.length} Teams)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {deliveryTeamCards.map((teamCard) => {
              const pct = teamCard.totalInvoices > 0 ? Math.round((teamCard.deliveredCount / teamCard.totalInvoices) * 100) : 0;
              return (
                <div
                  key={teamCard.plateNumber}
                  className="glass-panel hover-bright"
                  style={{
                    padding: '20px', borderRadius: '16px', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer',
                  }}
                  onClick={() => {
                    setSelectedTeamPlate(teamCard.plateNumber);
                    setViewMode('invoices');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} style={{ color: 'var(--accent-primary)' }} />
                        {teamCard.plateNumber}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px', fontWeight: 500 }}>
                        Driver: {teamCard.driverName}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                      {teamCard.assignedDdrms.length} DDRMS
                    </span>
                  </div>

                  {teamCard.helpers.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} /> Helpers: {teamCard.helpers.join(', ')}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Progress: {pct}%</span>
                      <span style={{ color: 'var(--accent-success)', fontWeight: 600 }}>₱{teamCard.totalGross.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--accent-success)' }} />
                      {teamCard.notDeliveredCount > 0 && (
                        <div style={{ width: `${(teamCard.notDeliveredCount / teamCard.totalInvoices) * 100}%`, background: 'var(--accent-danger)' }} />
                      )}
                    </div>
                  </div>

                  {/* Status counts pills */}
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Delivered: <strong style={{ color: '#10b981' }}>{teamCard.deliveredCount}</strong></span>
                    <span style={{ color: 'var(--text-muted)' }}>Pending: <strong style={{ color: '#f59e0b' }}>{teamCard.pendingCount}</strong></span>
                    {teamCard.notDeliveredCount > 0 && (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>🚨 ND: {teamCard.notDeliveredCount}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIEW 2: INVOICE LIST */
        <>
          {/* Active Filter Pill if team selected */}
          {selectedTeamPlate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Filtered by Team Plate:</span>
              <span style={{ fontWeight: 700, background: 'var(--accent-primary)', color: 'white', padding: '2px 10px', borderRadius: '12px' }}>
                {selectedTeamPlate}
              </span>
              <button onClick={() => setSelectedTeamPlate(null)} className="btn" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Clear Filter
              </button>
            </div>
          )}

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All', count: statusCounts.all },
              { key: 'Not Delivered', label: '🚨 Not Delivered', count: statusCounts['Not Delivered'] },
              { key: 'Pending', label: 'Pending', count: statusCounts.Pending },
              { key: 'Delivered', label: 'Delivered', count: statusCounts.Delivered },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className="btn"
                style={{
                  padding: '8px 16px', fontSize: '13px', borderRadius: '8px',
                  background: statusFilter === tab.key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: statusFilter === tab.key ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${statusFilter === tab.key ? 'var(--accent-primary)' : 'var(--border)'}`,
                }}
              >
                {tab.label} <span style={{ opacity: 0.7 }}>({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="deliveries-search"
              type="text"
              placeholder="Search customer, invoice #, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          {/* Invoice Cards */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-panel skeleton" style={{ height: '80px', borderRadius: '12px' }} />
              ))}
            </div>
          ) : allInvoices.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>No delivery invoices to display</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allInvoices.map((item, idx) => {
                const badge = getStatusBadge(item.invoice.deliveryStatus);
                const isNotDelivered = item.invoice.deliveryStatus === 'Not Delivered';

                return (
                  <div
                    key={`${item.ddrmsId}-${item.invoice.id}`}
                    className="glass-panel"
                    style={{
                      padding: '14px 18px', borderRadius: '12px',
                      animation: `fadeIn 0.3s ease-out ${idx * 0.03}s both`,
                      background: isNotDelivered ? 'rgba(239, 68, 68, 0.12)' : undefined,
                      border: isNotDelivered ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
                      boxShadow: isNotDelivered ? '0 0 20px rgba(239, 68, 68, 0.08)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      {/* System Invoice Badge */}
                      <div style={{
                        minWidth: '90px', fontWeight: 700, fontSize: '14px',
                        fontFamily: 'monospace', color: isNotDelivered ? '#ef4444' : 'var(--accent-primary)',
                      }}>
                        #{item.invoice.systemInvoiceNumber}
                      </div>

                      {/* Customer Info */}
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.invoice.customerName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.invoice.barangay}, {item.invoice.city} • ₱{item.invoice.grossAmount.toLocaleString()}
                        </div>
                      </div>

                      {/* DDRMS Info */}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '80px' }}>
                        <div>DDRMS: {item.ddrmsNumber}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Truck size={12} /> {item.plateNumber}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {badge.icon} {badge.label}
                      </span>

                      {/* Confirm Button for authorized roles (Delivery Team, Warehouse Supervisor, Admin) */}
                      {canConfirm && item.invoice.deliveryStatus === 'Pending' && (
                        <button
                          onClick={() => handleOpenConfirm(item.ddrmsId, item.invoice)}
                          className="btn btn-primary"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                        >
                          Confirm
                        </button>
                      )}
                      {role === 'admin' && item.invoice.deliveryStatus !== 'Pending' && (
                        <button
                          onClick={() => handleOpenConfirm(item.ddrmsId, item.invoice)}
                          className="btn"
                          style={{ fontSize: '12px', padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                        >
                          Override
                        </button>
                      )}
                    </div>

                    {/* Not Delivered Reason Display */}
                    {isNotDelivered && item.invoice.notDeliveredReason && (
                      <div style={{
                        marginTop: '8px', padding: '6px 12px', borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.08)', fontSize: '12px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                        <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <span style={{ color: '#fca5a5' }}>
                          <strong>Reason:</strong> {item.invoice.notDeliveredReason}
                          {item.invoice.remarks && <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>— {item.invoice.remarks}</span>}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delivery Confirmation Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Confirm Delivery"
        maxWidth="450px"
      >
        {selectedInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Invoice Summary */}
            <div className="glass-panel" style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.5)' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>System Invoice</div>
              <div style={{ fontWeight: 700, fontSize: '18px', fontFamily: 'monospace' }}>#{selectedInvoice.invoice.systemInvoiceNumber}</div>
              <div style={{ fontSize: '14px', marginTop: '6px' }}>{selectedInvoice.invoice.customerName}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedInvoice.invoice.barangay}, {selectedInvoice.invoice.city} • ₱{selectedInvoice.invoice.grossAmount.toLocaleString()}
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Delivery Status *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['Delivered', 'Not Delivered'] as DeliveryStatus[]).map((status) => {
                  const isActive = confirmStatus === status;
                  const isND = status === 'Not Delivered';
                  return (
                    <button
                      key={status}
                      onClick={() => setConfirmStatus(status)}
                      className="btn"
                      style={{
                        flex: 1, padding: '12px', fontSize: '14px', fontWeight: 600,
                        borderRadius: '10px',
                        background: isActive
                          ? (isND ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)')
                          : 'rgba(255,255,255,0.05)',
                        color: isActive
                          ? (isND ? '#ef4444' : '#10b981')
                          : 'var(--text-muted)',
                        border: `2px solid ${isActive ? (isND ? '#ef4444' : '#10b981') : 'var(--border)'}`,
                      }}
                    >
                      {isND ? <><XCircle size={16} /> Not Delivered</> : <><CheckCircle size={16} /> Delivered</>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Not Delivered Reason */}
            {confirmStatus === 'Not Delivered' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Reason *</label>
                <select
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value as NotDeliveredReason)}
                  id="delivery-reason-select"
                >
                  <option value="">Select reason...</option>
                  {NOT_DELIVERED_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Remarks (optional)</label>
              <textarea
                value={confirmRemarks}
                onChange={(e) => setConfirmRemarks(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleConfirmDelivery}
              className="btn btn-primary"
              disabled={saving || (confirmStatus === 'Not Delivered' && !confirmReason)}
              style={{
                background: confirmStatus === 'Not Delivered' ? 'var(--accent-danger)' : 'var(--accent-success)',
              }}
              id="confirm-delivery-btn"
            >
              {saving ? 'Updating...' : `Confirm as ${confirmStatus}`}
            </button>
          </div>
        )}
      </Modal>

      {/* QR Scanner Modal */}
      <Modal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Scan DDRMS QR Code"
        maxWidth="440px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="tactical-hud-container">
            <div className="tactical-hud-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tactical-pulse-dot" /> TACTICAL SCANNER ACTIVE
              </span>
              <span>LOGISTICS DISPATCH</span>
            </div>

            <div className="tactical-viewport">
              {/* Video Reader Element */}
              <div id="qr-reader"></div>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            Position the printed DDRMS QR code inside the green tactical frame to scan.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveriesPage;
