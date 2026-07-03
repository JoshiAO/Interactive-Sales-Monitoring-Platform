import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNpdPromoData } from '../../hooks/useNpdPromoData';
import { useTeams } from '../../hooks/useTeams';
import { Modal } from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

const formatCurrency = (val: number) =>
  `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const isNpd = type?.toUpperCase() === 'NPD';
  return (
    <span style={{
      position: 'absolute', top: '10px', right: '10px',
      padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
      backgroundColor: isNpd ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 146, 60, 0.2)',
      color: isNpd ? 'var(--accent-success)' : '#fb923c',
      border: `1px solid ${isNpd ? 'rgba(16, 185, 129, 0.4)' : 'rgba(251, 146, 60, 0.4)'}`,
      letterSpacing: '0.5px'
    }}>
      {isNpd ? 'NPD' : 'PROMO'}
    </span>
  );
};

const NpdPromoPacks: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'NPD' | 'PROMOPACK'>('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedModalSalesman, setSelectedModalSalesman] = useState<any | null>(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalSort, setModalSort] = useState<{ key: 'name' | 'stt' | 'uba'; dir: 'asc' | 'desc' }>({ key: 'stt', dir: 'desc' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSort, setCustomerSort] = useState<{ key: 'name' | 'stt' | 'uba'; dir: 'asc' | 'desc' }>({ key: 'stt', dir: 'desc' });

  const { loading, items } = useNpdPromoData(selectedTeam);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Hide items with 0 STT and 0 UBA
      if (item.stt <= 0 && item.uba <= 0) return false;

      const matchSearch =
        item.product_code.toLowerCase().includes(search.toLowerCase()) ||
        item.product_description.toLowerCase().includes(search.toLowerCase());
      const matchType =
        typeFilter === 'all' ||
        item.type?.toUpperCase() === typeFilter;
      return matchSearch && matchType;
    });
  }, [items, search, typeFilter]);

  const modalSalesmen = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.salesmen
      .filter((s: any) =>
        s.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(modalSearch.toLowerCase())
      )
      .sort((a: any, b: any) => {
        const dir = modalSort.dir === 'asc' ? 1 : -1;
        if (modalSort.key === 'name') return a.name.localeCompare(b.name) * dir;
        if (modalSort.key === 'stt') return (a.stt - b.stt) * dir;
        if (modalSort.key === 'uba') return (a.uba - b.uba) * dir;
        return 0;
      });
  }, [selectedItem, modalSearch, modalSort]);

  const handleSort = (key: 'name' | 'stt' | 'uba') => {
    setModalSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortArrow = (key: string) => {
    if (modalSort.key !== key) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{modalSort.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  const modalCustomers = useMemo(() => {
    if (!selectedModalSalesman || !selectedModalSalesman.customers) return [];
    return selectedModalSalesman.customers
      .filter((c: any) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code.toLowerCase().includes(customerSearch.toLowerCase())
      )
      .sort((a: any, b: any) => {
        const dir = customerSort.dir === 'asc' ? 1 : -1;
        if (customerSort.key === 'name') return a.name.localeCompare(b.name) * dir;
        if (customerSort.key === 'stt') return (a.stt - b.stt) * dir;
        if (customerSort.key === 'uba') return (a.uba - b.uba) * dir;
        return 0;
      });
  }, [selectedModalSalesman, customerSearch, customerSort]);

  const handleCustomerSort = (key: 'name' | 'stt' | 'uba') => {
    setCustomerSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const customerSortArrow = (key: string) => {
    if (customerSort.key !== key) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{customerSort.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>NPD & Promo Packs</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>
            New Product Development and Promotional Pack performance by item
          </p>
        </div>

        {/* Team slicer (Manager/Admin) */}
        {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {availableTeams.map(t => (
              <button key={t} onClick={() => setSelectedTeam(t)} style={{
                padding: '4px 12px', borderRadius: '16px', border: '1px solid',
                borderColor: selectedTeam === t ? 'var(--accent-primary)' : 'var(--border)',
                backgroundColor: selectedTeam === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                color: selectedTeam === t ? '#fff' : 'var(--text-muted)',
                fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s'
              }}>{t}</button>
            ))}
            {selectedTeam !== 'all' && (
              <button onClick={() => setSelectedTeam('all')} style={{
                padding: '4px 12px', borderRadius: '16px', border: 'none',
                backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)',
                fontSize: '12px', cursor: 'pointer'
              }}>Clear</button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by product code or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['all', 'NPD', 'PROMOPACK'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={{
              padding: '8px 16px', borderRadius: '20px', border: '1px solid',
              borderColor: typeFilter === f ? 'var(--accent-primary)' : 'var(--border)',
              backgroundColor: typeFilter === f ? 'var(--accent-primary)' : 'transparent',
              color: typeFilter === f ? '#fff' : 'var(--text-muted)',
              fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: typeFilter === f ? 600 : 400
            }}>
              {f === 'all' ? 'All' : f === 'NPD' ? 'NPD' : 'Promo Packs'}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
        Showing <strong style={{ color: 'var(--text-main)' }}>{filteredItems.length}</strong> items
      </div>

      {/* Loading */}
      {loading ? <PageSkeleton /> : filteredItems.length === 0 ? (
        <div className="flex-center" style={{ height: '30vh', flexDirection: 'column', gap: '12px', color: 'var(--text-muted)' }}>
          <p>No items found{search ? ` for "${search}"` : ''}.</p>
          <p style={{ fontSize: '12px' }}>Upload NPD & Promo Pack Items in the Data page first.</p>
        </div>
      ) : (
        /* Item Cards Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {filteredItems.map(item => (
            <div
              key={item.product_code}
              className="glass-panel interactive"
              onClick={() => { setSelectedItem(item); setModalSearch(''); }}
              style={{ position: 'relative', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <TypeBadge type={item.type} />
              <div style={{ paddingRight: '60px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'monospace' }}>
                  {item.product_code}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', lineHeight: 1.3 }}>
                  {item.product_description}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {item.category}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>STT (Net Value)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    {formatCurrency(item.stt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>UBA</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-success)' }}>
                    {item.uba.toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {item.salesmen.length} {item.salesmen.length === 1 ? 'salesman' : 'salesmen'} · Click to view breakdown
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Detail Modal */}
      <Modal isOpen={!!selectedItem} onClose={() => { setSelectedItem(null); setSelectedModalSalesman(null); }} title={selectedItem?.product_description || ''}>
        {selectedItem && (
          <div>
            {!selectedModalSalesman ? (
              <>
                {/* Badge + summary */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <TypeBadge type={selectedItem.type} />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '60px' }}>{selectedItem.category}</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total STT</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(selectedItem.stt)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total UBA</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-success)' }}>{selectedItem.uba.toLocaleString()}</div>
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search salesman..."
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px 8px 30px', boxSizing: 'border-box',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                  borderRadius: '8px', color: 'white', fontSize: '13px'
                }}
              />
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      { key: 'name', label: 'Salesman' },
                      { key: 'stt', label: 'STT (Net Value)' },
                      { key: 'uba', label: 'UBA' }
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key as any)}
                        style={{
                          padding: '8px 12px', textAlign: col.key === 'name' ? 'left' : 'right',
                          color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                          userSelect: 'none', whiteSpace: 'nowrap'
                        }}
                      >
                        {col.label}{sortArrow(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalSalesmen.map((s: any, idx: number) => (
                    <tr key={s.code} onClick={() => setSelectedModalSalesman(s)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.code}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: s.stt <= 0 ? 'var(--accent-danger)' : 'var(--accent-primary)', fontWeight: 600 }}>
                        {formatCurrency(s.stt)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: s.uba <= 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontWeight: 600 }}>
                        {s.uba.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {modalSalesmen.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No salesmen found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
              </>
            ) : (
              // --- CUSTOMER VIEW ---
              <>
                {/* Back button & Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <button onClick={() => setSelectedModalSalesman(null)} className="btn" style={{ padding: '8px', background: 'rgba(0,0,0,0.2)' }}>
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{selectedModalSalesman.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedModalSalesman.code}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Salesman STT</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(selectedModalSalesman.stt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Salesman UBA</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-success)' }}>{selectedModalSalesman.uba.toLocaleString()}</div>
                  </div>
                </div>

                {/* Customer Search */}
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 10px 8px 30px', boxSizing: 'border-box',
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                      borderRadius: '8px', color: 'white', fontSize: '13px'
                    }}
                  />
                </div>

                {/* Customer Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {[
                          { key: 'name', label: 'Customer' },
                          { key: 'stt', label: 'STT (Net Value)' },
                          { key: 'uba', label: 'UBA' }
                        ].map(col => (
                          <th
                            key={col.key}
                            onClick={() => handleCustomerSort(col.key as any)}
                            style={{
                              padding: '8px 12px', textAlign: col.key === 'name' ? 'left' : 'right',
                              color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer',
                              userSelect: 'none', whiteSpace: 'nowrap'
                            }}
                          >
                            {col.label}{customerSortArrow(col.key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modalCustomers.map((c: any, idx: number) => (
                        <tr key={c.code} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.code}</div>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: c.stt <= 0 ? 'var(--accent-danger)' : 'var(--accent-primary)', fontWeight: 600 }}>
                            {formatCurrency(c.stt)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: c.uba <= 0 ? 'var(--accent-danger)' : 'var(--accent-success)', fontWeight: 600 }}>
                            {c.uba.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {modalCustomers.length === 0 && (
                        <tr><td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No customers found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NpdPromoPacks;
