import React, { useState, useEffect, useMemo } from 'react';
import { Package, CheckCircle, XCircle, AlertTriangle, Search, Clock, Truck } from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../../components/ui/Modal';
import type { DDRMSHeader, DDRMSInvoice, DeliveryStatus, NotDeliveredReason } from '../../types/logistics';
import { DELIVERY_STATUS_PRIORITY, NOT_DELIVERED_REASONS } from '../../types/logistics';

const DeliveriesPage: React.FC = () => {
  const { role, currentUser } = useAuth();
  const [ddrmsRecords, setDdrmsRecords] = useState<DDRMSHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<{ ddrmsId: string; invoice: DDRMSInvoice } | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<DeliveryStatus>('Delivered');
  const [confirmReason, setConfirmReason] = useState<NotDeliveredReason | ''>('');
  const [confirmRemarks, setConfirmRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const isDeliveryTeam = role === 'delivery_team';
  const canConfirm = role === 'delivery_team' || role === 'admin' || role === 'warehouse_supervisor';

  // Flatten all invoices from all DDRMS for display
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'logistics_ddrms'), (snap) => {
      const records: DDRMSHeader[] = [];
      snap.forEach((d) => {
        records.push({ id: d.id, ...d.data() } as DDRMSHeader);
      });
      setDdrmsRecords(records);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Build flat invoice list with sorting: Not Delivered pinned at top
  const allInvoices = useMemo(() => {
    const invoices: Array<{ ddrmsId: string; ddrmsNumber: string; plateNumber: string; invoice: DDRMSInvoice }> = [];

    ddrmsRecords.forEach((ddrms) => {
      if (!ddrms.invoices) return;
      // For delivery team, only show their assigned DDRMS (by plate number matching email)
      if (isDeliveryTeam && currentUser?.email) {
        const plateFromEmail = currentUser.email.split('@')[0]?.toUpperCase();
        if (ddrms.plateNumber.toUpperCase() !== plateFromEmail) return;
      }
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
  }, [ddrmsRecords, statusFilter, searchQuery, isDeliveryTeam, currentUser]);

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
          return {
            ...inv,
            deliveryStatus: confirmStatus,
            notDeliveredReason: confirmStatus === 'Not Delivered' ? confirmReason : undefined,
            remarks: confirmRemarks.trim() || undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return inv;
      });

      // Check if all invoices are delivered/not-delivered to update DDRMS header status
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
      default:
        return { icon: <Clock size={14} />, bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'Pending' };
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { all: 0, Pending: 0, Delivered: 0, 'Not Delivered': 0 };
    ddrmsRecords.forEach((ddrms) => {
      if (!ddrms.invoices) return;
      ddrms.invoices.forEach((inv) => {
        counts.all++;
        counts[inv.deliveryStatus as keyof typeof counts]++;
      });
    });
    return counts;
  }, [ddrmsRecords]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={24} style={{ color: 'var(--accent-primary)' }} />
            Deliveries
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            {isDeliveryTeam ? 'Confirm delivery status for your assigned invoices' : 'Monitor delivery confirmations'}
          </p>
        </div>
      </div>

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

                  {/* Confirm Button for delivery team */}
                  {canConfirm && item.invoice.deliveryStatus === 'Pending' && (
                    <button
                      onClick={() => handleOpenConfirm(item.ddrmsId, item.invoice)}
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      Confirm
                    </button>
                  )}
                  {canConfirm && item.invoice.deliveryStatus !== 'Pending' && (
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
    </div>
  );
};

export default DeliveriesPage;
