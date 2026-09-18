import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useCustomersData } from '../../hooks/useCustomersData';
import { useTeams } from '../../hooks/useTeams';
import { Package, Users, BarChart3, Download, Search } from 'lucide-react';
import { PageSkeleton } from '../../components/ui/PageSkeleton';
import { exportVd30ToExcel } from '../../utils/excelExport';

const Meter: React.FC<{ target: number; actual: number }> = ({ target, actual }) => {
  const percent = Math.min((actual / (target || 1)) * 100, 100).toFixed(0);
  const color = actual >= target ? 'var(--accent-success)' : 'var(--accent-primary)';
  
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Achieved: {percent}%</span>
        <span>{actual} / {target}</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

const VD30: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalTab, setModalTab] = useState<'products' | 'customers'>('products');
  const [modalCustSearch, setModalCustSearch] = useState('');
  const [modalCustFilter, setModalCustFilter] = useState<'all' | 'buying' | 'non-buying'>('all');
  
  const [modalCustSort, setModalCustSort] = useState<'net-desc' | 'name-asc'>('net-desc');
  
  const { loading, data } = useDashboardData(selectedTeam);
  const { customers } = useCustomersData(selectedTeam);

  // Build product list per VD30 code from refVd30Items (already cached, no extra reads)
  const productsByVd30Code = useMemo(() => {
    const map: Record<string, Array<{ product_code: string; product_description: string, customers: number, volume: number }>> = {};
    (data.refVd30Items || []).forEach((item: any) => {
      const code = item.vd30_code;
      if (!code) return;
      if (!map[code]) map[code] = [];
      map[code].push({
        product_code: item.product_code || item.id || '',
        product_description: item.product_description || '',
        customers: item.customers || 0,
        volume: item.volume || 0
      });
    });
    return map;
  }, [data.refVd30Items]);

  const selectedItemCustomers = useMemo(() => {
    if (!selectedItem) return [];
    const baseCode = (selectedItem.name || selectedItem.code || '').split('_')[0].toUpperCase();
    const fullCode = (selectedItem.code || '').toUpperCase();

    const baseCodeMatch = (selectedItem.name || selectedItem.code || '').match(/F0*(\d+)/i);
    const fNum = baseCodeMatch ? parseInt(baseCodeMatch[1], 10) : 1;

    // Products belonging to this VD30 item group
    const groupProducts = selectedItem ? (productsByVd30Code[selectedItem.code] || []) : [];

    // VD30 eligibility rules:
    // F01-F19: Eligible for all SSS (Large + Small)
    // F20-F30: Eligible for Large SSS only
    const eligibleCustomers = customers.filter(c => {
      if (!c.isSariSariStore) return false;
      if (fNum >= 20 && fNum <= 30) {
        return c.isLargeSariSariStore;
      }
      return true;
    });

    return eligibleCustomers.map(c => {
      let vdVolume = 0;
      let vdNetValue = 0;

      if (groupProducts.length > 0) {
        groupProducts.forEach((prod: any) => {
          const pCode = prod.product_code;
          const pSales = c.productSales?.[pCode];
          if (pSales) {
            vdVolume += (pSales.volume || 0);
            vdNetValue += (pSales.netValue || 0);
          }
        });
      }

      const hasGroupProducts = groupProducts.length > 0;
      const isBought = hasGroupProducts
        ? (vdNetValue >= 1 || vdVolume >= 1)
        : (Array.isArray(c.vd30Bought) && (
            c.vd30Bought.includes(baseCode) || 
            c.vd30Bought.includes(fullCode) || 
            c.vd30Bought.some((code: string) => String(code).toUpperCase().startsWith(baseCode))
          ));

      return {
        ...c,
        vdVolume,
        vdNetValue,
        isVdBought: isBought
      };
    });
  }, [selectedItem, customers, productsByVd30Code]);

  const totalVdBuying = useMemo(() => selectedItemCustomers.filter(c => c.isVdBought).length, [selectedItemCustomers]);
  const totalVdNonBuying = useMemo(() => selectedItemCustomers.filter(c => !c.isVdBought).length, [selectedItemCustomers]);

  const filteredModalCustomers = useMemo(() => {
    const filtered = selectedItemCustomers.filter(c => {
      const matchesSearch = !modalCustSearch || 
        c.name.toLowerCase().includes(modalCustSearch.toLowerCase()) || 
        c.id.toLowerCase().includes(modalCustSearch.toLowerCase());
      const matchesFilter = modalCustFilter === 'all' ? true :
        modalCustFilter === 'buying' ? c.isVdBought : !c.isVdBought;
      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      if (modalCustSort === 'net-desc') {
        if (b.vdNetValue !== a.vdNetValue) {
          return b.vdNetValue - a.vdNetValue;
        }
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [selectedItemCustomers, modalCustSearch, modalCustFilter, modalCustSort]);

  if (loading && data.salesmen.length === 0) {
    return <PageSkeleton />;
  }

  const displayItems = data.vd30.filter(item => item.target > 0);

  // Get products for the selected VD30 item
  const selectedProducts = selectedItem ? (productsByVd30Code[selectedItem.code] || []) : [];

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>VD30 Performance</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          {(role === 'manager' || role === 'admin' || role === 'supervisor') && (
            <button
              onClick={() => exportVd30ToExcel(data.salesmen, data.refVd30Items, availableTeams, `VD30_Performance_${new Date().toISOString().split('T')[0]}.xlsx`)}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#10B981', // green for excel
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              title="Export VD30 Data to Excel"
            >
              <Download size={16} /> Export to Excel
            </button>
          )}
          {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
              {availableTeams.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTeam(t)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: selectedTeam === t ? 'var(--accent-primary)' : 'var(--border)',
                    backgroundColor: selectedTeam === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                    color: selectedTeam === t ? '#fff' : 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {t}
                </button>
              ))}
              {selectedTeam !== 'all' && (
                <button
                  onClick={() => setSelectedTeam('all')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--accent-danger)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginLeft: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Bar Chart */}
      <div className="glass-panel" style={{ height: '350px', marginBottom: '32px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>Overall VD30 Achievement</h3>
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={displayItems} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
              <Tooltip 
                formatter={(value: any, name: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), String(name)]}
                contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-main)' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar name="Target" dataKey="target" fill="rgba(255,255,255,0.2)" radius={[4, 4, 0, 0]} />
              <Bar name="Actual" dataKey="actual" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Itemized Cards Grid */}
      <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-main)' }}>Itemized Performance (Top 30 Core)</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '16px' 
      }}>
        {displayItems.map(item => (
          <div 
            key={item.code} 
            className="glass-panel interactive" 
            style={{ padding: '16px', cursor: 'pointer' }} 
            onClick={() => {
              setSelectedItem(item);
              setModalTab('products');
              setModalCustSearch('');
              setModalCustFilter('all');
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '15px' }}>{item.code}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', minHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.description || 'No Description'}
            </div>
            <Meter target={item.target} actual={item.actual} />
          </div>
        ))}
        {displayItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
            No VD30 data available.
          </div>
        )}
      </div>

      {/* VD30 Item Detail Modal */}
      <Modal 
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.code || ''}
      >
        {selectedItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header */}
            <div style={{ fontWeight: '500', color: 'var(--accent-primary)', fontSize: '18px' }}>
              {selectedItem.description}
            </div>

            {/* Stats Row */}
            {(() => {
              const displayActual = totalVdBuying;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <BarChart3 size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Index</span>
                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: displayActual >= selectedItem.target ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {((displayActual / (selectedItem.target || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div 
                    onClick={() => setModalTab('customers')}
                    style={{ 
                      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', 
                      background: modalTab === 'customers' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', 
                      borderRadius: '8px', cursor: 'pointer',
                      border: modalTab === 'customers' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      transition: 'all 0.2s'
                    }}
                    title="Click to view Customer List"
                  >
                    <Users size={16} color={modalTab === 'customers' ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                    <span style={{ fontSize: '11px', color: modalTab === 'customers' ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: '4px' }}>Customers</span>
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{displayActual}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <Package size={16} color="var(--text-muted)" />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Target</span>
                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{selectedItem.target}</span>
                  </div>
                </div>
              );
            })()}

            {/* Sub-Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <button
                onClick={() => setModalTab('products')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 16px', borderRadius: '8px', border: 'none',
                  backgroundColor: modalTab === 'products' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: modalTab === 'products' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Package size={14} /> Products ({selectedProducts.length})
              </button>
              <button
                onClick={() => setModalTab('customers')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 16px', borderRadius: '8px', border: 'none',
                  backgroundColor: modalTab === 'customers' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: modalTab === 'customers' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Users size={14} /> Customers ({totalVdBuying})
              </button>
            </div>

            {/* Tab 1: Products */}
            {modalTab === 'products' && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} />
                  Products in this VD30 Group ({selectedProducts.length})
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedProducts.length > 0 ? (
                    selectedProducts.map((product: any, idx: number) => (
                      <div key={idx} style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        padding: '10px 12px', background: 'rgba(255,255,255,0.03)', 
                        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' 
                      }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ 
                            fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)', 
                            fontWeight: 600, whiteSpace: 'nowrap'
                          }}>
                            {product.product_code}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                            {product.product_description || 'No description'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '16px', minWidth: '120px', justifyContent: 'flex-end' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Customers</span>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: product.customers > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                              {product.customers}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Volume</span>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: product.volume > 0 ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                              {product.volume.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No product reference data available for this VD30 group.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Customer List */}
            {modalTab === 'customers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Search and Filters */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search code or name..." 
                      value={modalCustSearch}
                      onChange={e => setModalCustSearch(e.target.value)}
                      style={{ paddingLeft: '32px', width: '100%', padding: '6px 12px 6px 32px', fontSize: '12px', borderRadius: '6px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => setModalCustFilter('all')}
                      style={{
                        padding: '4px 10px', borderRadius: '12px', border: 'none',
                        backgroundColor: modalCustFilter === 'all' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                        color: modalCustFilter === 'all' ? '#fff' : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      All ({selectedItemCustomers.length})
                    </button>
                    <button
                      onClick={() => setModalCustFilter('buying')}
                      style={{
                        padding: '4px 10px', borderRadius: '12px', border: 'none',
                        backgroundColor: modalCustFilter === 'buying' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: modalCustFilter === 'buying' ? 'var(--accent-success)' : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Buying ({totalVdBuying})
                    </button>
                    <button
                      onClick={() => setModalCustFilter('non-buying')}
                      style={{
                        padding: '4px 10px', borderRadius: '12px', border: 'none',
                        backgroundColor: modalCustFilter === 'non-buying' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: modalCustFilter === 'non-buying' ? 'var(--accent-danger)' : 'var(--text-muted)',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Non-Buying ({totalVdNonBuying})
                    </button>

                    <select
                      value={modalCustSort}
                      onChange={e => setModalCustSort(e.target.value as any)}
                      style={{
                        padding: '4px 8px', borderRadius: '12px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'var(--text-main)',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <option value="net-desc">Sort: Net (High → Low)</option>
                      <option value="name-asc">Sort: Name (A → Z)</option>
                    </select>
                  </div>
                </div>

                {/* Customer List Container */}
                <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredModalCustomers.length > 0 ? (
                    filteredModalCustomers.map(cust => (
                      <div 
                        key={cust.id} 
                        style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                          padding: '10px 12px', background: 'rgba(255,255,255,0.03)', 
                          borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' 
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden', paddingRight: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cust.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {cust.id} • {cust.barangay}, {cust.city}
                          </span>
                          <div style={{ 
                            fontSize: '11px', 
                            color: cust.isVdBought ? 'var(--accent-success)' : 'var(--text-muted)', 
                            display: 'flex', gap: '12px', marginTop: '2px', fontWeight: 600 
                          }}>
                            <span>Vol: {cust.vdVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CS</span>
                            <span>Net: ₱{cust.vdNetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', flexShrink: 0,
                          backgroundColor: cust.isVdBought ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: cust.isVdBought ? 'var(--accent-success)' : 'var(--accent-danger)',
                          border: `1px solid ${cust.isVdBought ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {cust.isVdBought ? 'Buying' : 'Non-Buying'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No customers found matching the selected filter.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VD30;
