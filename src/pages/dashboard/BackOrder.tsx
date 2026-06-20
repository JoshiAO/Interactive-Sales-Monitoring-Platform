import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Search, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Calendar, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeams } from '../../hooks/useTeams';
import { useTradeBoData, useTradeBoCustomers, type TradeCustomer } from '../../hooks/useTradeBoData';
import { useWarehouseBoData } from '../../hooks/useWarehouseBoData';
import { useVanBoData } from '../../hooks/useVanBoData';
import { usePricelist } from '../../hooks/usePricelist';
import { useItemCategories } from '../../hooks/useItemCategories';
import { Modal } from '../../components/ui/Modal';

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const formatCurrency = (val: number) =>
  `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatShortCurrency = (val: number) => {
  if (Math.abs(val) >= 1_000_000) {
    return `₱${(val / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  } else if (Math.abs(val) >= 1_000) {
    return `₱${(val / 1_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
  }
  return `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── Sortable Table ──────────────────────────────────────────────────────────
interface SortableTableProps {
  columns: Array<{ key: string; label: string; align?: 'right' }>;
  rows: any[];
  emptyMsg?: string;
}
const SortableTable: React.FC<SortableTableProps> = ({ columns, rows, emptyMsg }) => {
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | 'none'>('none');
  const [page, setPage] = useState(1);
  const PAGE = 50;

  const sorted = useMemo(() => {
    if (!sortKey || sortDir === 'none') return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      let cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(0, page * PAGE), [sorted, page]);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(''); setSortDir('none'); }
  };

  const Icon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronsUpDown size={11} style={{ marginLeft: '3px', opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={11} style={{ marginLeft: '3px', color: 'var(--accent-primary)' }} />
      : <ChevronDown size={11} style={{ marginLeft: '3px', color: 'var(--accent-primary)' }} />;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)} style={{
                padding: '10px 12px', textAlign: col.align || 'left',
                color: sortKey === col.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>{col.label}<Icon col={col.key} /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paged.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
              {columns.map(col => (
                <td key={col.key} style={{ padding: '9px 12px', textAlign: col.align || 'left', whiteSpace: col.align === 'right' ? 'nowrap' : undefined }}>
                  {col.key === 'amount' ? formatCurrency(row[col.key] || 0) : (row[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
          {paged.length === 0 && (
            <tr><td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{emptyMsg || 'No data.'}</td></tr>
          )}
        </tbody>
      </table>
      {paged.length < sorted.length && (
        <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setPage(p => p + 1)} className="btn" style={{ border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', padding: '6px 20px', fontSize: '13px' }}>
            Load More ({sorted.length - paged.length} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

const SlicerRow: React.FC<{ options: string[], selected: string, onSelect: (val: string) => void, label: string }> = ({ options, selected, onSelect, label }) => (
  <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center', paddingBottom: '8px' }}>
    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px', whiteSpace: 'nowrap' }}>{label}</span>
    {options.map(opt => (
      <button key={opt} onClick={() => onSelect(opt === selected ? 'all' : opt)} style={{
        flexShrink: 0, padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
        borderColor: selected === opt ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
        background: selected === opt ? 'var(--accent-primary)' : 'rgba(0,0,0,0.3)',
        color: selected === opt ? '#fff' : 'var(--text-muted)'
      }}>{opt}</button>
    ))}
    {selected !== 'all' && (
      <button onClick={() => onSelect('all')} style={{
        flexShrink: 0, padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)'
      }}>Clear</button>
    )}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const BackOrder: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [activeTab, setActiveTab] = useState<'trade' | 'warehouse' | 'van'>('trade');
  const [selectedSalesman, setSelectedSalesman] = useState<any | null>(null);
  const [selectedVan, setSelectedVan] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<TradeCustomer | null>(null);
  const [wSearch, setWSearch] = useState('');
  const [wBranch, setWBranch] = useState('all');
  const [wCategory, setWCategory] = useState('all');
  const [vSearch, setVSearch] = useState('');
  const [vCategory, setVCategory] = useState('all');
  const [custProductCategory, setCustProductCategory] = useState('all');

  useEffect(() => {
    setCustProductCategory('all');
  }, [selectedCustomer]);

  const canSeeAdminTabs = role === 'admin' || role === 'manager' || role === 'supervisor' || role === 'warehouse_supervisor';

  const { loading: priceLoading, priceMap } = usePricelist();
  const { categoryMap } = useItemCategories();
  const { loading: tradeLoading, salesmen, history: tradeHistory, totalBsr } = useTradeBoData(selectedTeam);
  const { loading: whLoading, items: whItems, categories: whCats, branches: whBranches, totalAmount: whTotalAmount, uploadDate: whUploadDate } = useWarehouseBoData(priceMap, priceLoading);
  const { loading: vanLoading, items: vanItems, categories: vanCats, vans, totalAmount: vanTotalAmount, uploadDate: vanUploadDate } = useVanBoData(priceMap, priceLoading);
  const { loading: custLoading, customers } = useTradeBoCustomers(selectedSalesman?.code || null);

  // ─── Warehouse derived data ─────────────────────────────────────────────
  const filteredWh = useMemo(() => whItems.filter(i =>
    (wBranch === 'all' || i.branch_name === wBranch) &&
    (wCategory === 'all' || i.category === wCategory) &&
    (!wSearch || i.product_code.toLowerCase().includes(wSearch.toLowerCase()) || i.product_description.toLowerCase().includes(wSearch.toLowerCase()))
  ), [whItems, wBranch, wCategory, wSearch]);

  const whCategoryChart = useMemo(() => {
    const m: Record<string, number> = {};
    filteredWh.forEach(i => { m[i.category] = (m[i.category] || 0) + i.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredWh]);

  const whBranchChart = useMemo(() => {
    const m: Record<string, number> = {};
    filteredWh.forEach(i => { m[i.branch_name] = (m[i.branch_name] || 0) + i.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filteredWh]);

  // ─── Van derived data ────────────────────────────────────────────────────
  const filteredVan = useMemo(() => vanItems.filter(i =>
    (!selectedVan || i.van_code === selectedVan) &&
    (vCategory === 'all' || i.category === vCategory) &&
    (!vSearch || i.product_code.toLowerCase().includes(vSearch.toLowerCase()) || i.product_description.toLowerCase().includes(vSearch.toLowerCase()))
  ), [vanItems, selectedVan, vCategory, vSearch]);

  const vanCategoryChart = useMemo(() => {
    const m: Record<string, number> = {};
    filteredVan.forEach(i => { m[i.category] = (m[i.category] || 0) + i.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredVan]);

  const vanShareChart = useMemo(() => {
    const m: Record<string, number> = {};
    vanItems.forEach(i => { m[i.van_code] = (m[i.van_code] || 0) + i.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [vanItems]);

  // ─── Customer modal filtered ──────────────────────────────────────────────
  const [custSearch, setCustSearch] = useState('');
  const [custProvince, setCustProvince] = useState('all');
  const [custCity, setCustCity] = useState('all');
  const [custBarangay, setCustBarangay] = useState('all');
  const provinces = useMemo(() => Array.from(new Set(customers.map(c => c.province).filter(Boolean))).sort(), [customers]);
  const cities = useMemo(() => Array.from(new Set(customers.filter(c => custProvince === 'all' || c.province === custProvince).map(c => c.city).filter(Boolean))).sort(), [customers, custProvince]);
  const barangays = useMemo(() => Array.from(new Set(customers.filter(c => custCity === 'all' || c.city === custCity).map(c => c.barangay).filter(Boolean))).sort(), [customers, custCity]);

  const filteredCustomers = useMemo(() => customers.filter(c =>
    (custProvince === 'all' || c.province === custProvince) &&
    (custCity === 'all' || c.city === custCity) &&
    (custBarangay === 'all' || c.barangay === custBarangay) &&
    (!custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.id.toLowerCase().includes(custSearch.toLowerCase()))
  ), [customers, custSearch, custProvince, custCity, custBarangay]);

  const selectStyle: React.CSSProperties = {
    padding: '7px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'white', fontSize: '13px', cursor: 'pointer'
  };

  const chartTooltipStyle = {
    contentStyle: { background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f8fafc' },
    labelStyle: { color: '#94a3b8' }
  };



  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Back Order</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '14px' }}>Trade, Warehouse, and Van back order tracking</p>
        </div>
        {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && activeTab === 'trade' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {availableTeams.map(t => (
              <button key={t} onClick={() => setSelectedTeam(t)} style={{
                padding: '4px 12px', borderRadius: '16px', border: '1px solid',
                borderColor: selectedTeam === t ? 'var(--accent-primary)' : 'var(--border)',
                backgroundColor: selectedTeam === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                color: selectedTeam === t ? '#fff' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer'
              }}>{t}</button>
            ))}
            {selectedTeam !== 'all' && (
              <button onClick={() => setSelectedTeam('all')} style={{ padding: '4px 12px', borderRadius: '16px', border: 'none', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)', fontSize: '12px', cursor: 'pointer' }}>Clear</button>
            )}
          </div>
        )}
      </div>

      {/* Trade History Line Graph */}
      {tradeHistory.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '24px', height: '260px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>Trade B.O. History (BSR)</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={tradeHistory} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                <Line type="monotone" dataKey="totalBsr" stroke="var(--accent-danger)" strokeWidth={2} dot={{ r: 4 }} name="Trade B.O. (BSR)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ flex: 1, minWidth: '220px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Trade B.O. (BSR)</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCurrency(totalBsr)}</div>
        </div>
        {canSeeAdminTabs && (
          <>
            <div className="glass-panel" style={{ flex: 1, minWidth: '220px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Warehouse B.O.</div>
                {whUploadDate && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <Calendar size={10} style={{ color: '#f59e0b' }} />
                    <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>{whUploadDate}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(whTotalAmount)}</div>
            </div>
            <div className="glass-panel" style={{ flex: 1, minWidth: '220px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Van B.O.</div>
                {vanUploadDate && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <Calendar size={10} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontSize: '10px', color: '#8b5cf6', fontWeight: 600 }}>{vanUploadDate}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#8b5cf6' }}>{formatCurrency(vanTotalAmount)}</div>
            </div>
          </>
        )}
      </div>

      {/* Tab Selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', width: '100%' }}>
        {(['trade', ...(canSeeAdminTabs ? ['warehouse', 'van'] : [])] as string[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} style={{
            flex: 1, padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === tab ? '#fff' : 'var(--text-muted)',
            fontWeight: activeTab === tab ? 600 : 400, fontSize: '14px', textTransform: 'capitalize', transition: 'all 0.2s'
          }}>{tab === 'van' ? 'Van (Ex-Truck)' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        ))}
      </div>

      {/* ═══ TRADE TAB ═══════════════════════════════════════════════════════ */}
      {activeTab === 'trade' && (
        tradeLoading ? (
          <div className="flex-center" style={{ height: '30vh', color: 'var(--accent-primary)' }}><Loader2 size={32} className="animate-spin" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {salesmen.map(s => (
              <div key={s.code} className="glass-panel interactive" onClick={() => { setSelectedSalesman(s); setCustSearch(''); setCustProvince('all'); setCustCity('all'); setCustBarangay('all'); }}
                style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  {s.photoURL ? (
                    <img src={s.photoURL} alt={s.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px', color: '#fff', flexShrink: 0 }}>
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bo-name-scroll-container">
                      <div className="bo-name-scroll-text" title={s.name}>
                        {s.name}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '4px' }}>{s.code}</div>
                    <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-danger)', fontSize: '10px', fontWeight: 700 }}>
                      {((s.stt + s.gsr + s.bsr) > 0 ? (s.bsr / (s.stt + s.gsr + s.bsr)) * 100 : 0).toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>STT</div>
                    <div title={formatCurrency(s.stt)} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent-primary)', cursor: 'help' }}>{formatShortCurrency(s.stt)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trade B.O.</div>
                    <div title={formatCurrency(s.bsr)} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-danger)', cursor: 'help' }}>{formatShortCurrency(s.bsr)}</div>
                  </div>
                </div>
              </div>
            ))}
            {salesmen.length === 0 && (
              <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No Trade B.O. data available. Upload Net Invoiced data to see BSR values.
              </div>
            )}
          </div>
        )
      )}

      {/* ═══ WAREHOUSE TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'warehouse' && canSeeAdminTabs && (
        (whLoading || priceLoading) ? (
          <div className="flex-center" style={{ height: '30vh', color: 'var(--accent-primary)' }}><Loader2 size={32} className="animate-spin" /></div>
        ) : (
          <div>
            {/* Bar + Pie Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>By Category</h3>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={whCategoryChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={90} stroke="var(--text-muted)" fontSize={10} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>By Branch</h3>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={whBranchChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {whBranchChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Filters + Table */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>Warehouse B.O. Items</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Search items..." value={wSearch} onChange={e => setWSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 28px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '13px' }} />
                </div>
                {whBranches.length > 0 && (
                  <SlicerRow options={whBranches} selected={wBranch} onSelect={setWBranch} label="Branches:" />
                )}
                {whCats.length > 0 && (
                  <SlicerRow options={whCats} selected={wCategory} onSelect={setWCategory} label="Categories:" />
                )}
              </div>
              <SortableTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'branch_name', label: 'Branch' },
                  { key: 'category', label: 'Category' },
                  { key: 'product_code', label: 'Product Code' },
                  { key: 'product_description', label: 'Description' },
                  { key: 'uom', label: 'UOM' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                  { key: 'srs_reference', label: 'SRS No.' },
                  { key: 'amount', label: 'Amount', align: 'right' }
                ]}
                rows={filteredWh}
                emptyMsg="No warehouse B.O. items. Upload a Warehouse B.O. file in the Data page."
              />
            </div>
          </div>
        )
      )}

      {/* ═══ VAN TAB ═════════════════════════════════════════════════════════ */}
      {activeTab === 'van' && canSeeAdminTabs && (
        (vanLoading || priceLoading) ? (
          <div className="flex-center" style={{ height: '30vh', color: 'var(--accent-primary)' }}><Loader2 size={32} className="animate-spin" /></div>
        ) : (
          <div>
            {/* Bar + Pie Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>By Category</h3>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={vanCategoryChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={90} stroke="var(--text-muted)" fontSize={10} />
                      <Tooltip {...chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Amount" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-panel" style={{ height: '260px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>By Van</h3>
                <div style={{ flex: 1 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={vanShareChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {vanShareChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Van Cards (horizontal scroll) */}
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
              <button onClick={() => setSelectedVan(null)} style={{
                flexShrink: 0, padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${selectedVan === null ? 'var(--accent-primary)' : 'var(--border)'}`,
                background: selectedVan === null ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)',
                color: selectedVan === null ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}>All Vans</button>
              {vans.map(v => (
                <div key={v.van_code} onClick={() => setSelectedVan(v.van_code === selectedVan ? null : v.van_code)}
                  className="interactive"
                  style={{
                    flexShrink: 0, padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                    border: `1px solid ${selectedVan === v.van_code ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: selectedVan === v.van_code ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.2)',
                    minWidth: '140px'
                  }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: selectedVan === v.van_code ? 'var(--accent-primary)' : 'var(--text-main)', fontFamily: 'monospace' }}>{v.van_code}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{v.salesman_name}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#8b5cf6', marginTop: '6px' }}>{formatCurrency(v.totalAmount)}</div>
                </div>
              ))}
            </div>

            {/* Van Table */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '16px' }}>
                Van B.O. Items {selectedVan ? `— ${selectedVan}` : '(All Vans)'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="Search items..." value={vSearch} onChange={e => setVSearch(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px 8px 28px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '13px' }} />
                </div>
                {vanCats.length > 0 && (
                  <SlicerRow options={vanCats} selected={vCategory} onSelect={setVCategory} label="Categories:" />
                )}
              </div>
              <SortableTable
                columns={[
                  { key: 'date', label: 'Date' },
                  { key: 'van_code', label: 'Van Code' },
                  { key: 'salesman_code', label: 'Salesman Code' },
                  { key: 'branch_name', label: 'Branch' },
                  { key: 'category', label: 'Category' },
                  { key: 'product_code', label: 'Product Code' },
                  { key: 'product_description', label: 'Description' },
                  { key: 'uom', label: 'UOM' },
                  { key: 'qty', label: 'Qty', align: 'right' },
                  { key: 'amount', label: 'Amount', align: 'right' }
                ]}
                rows={filteredVan}
                emptyMsg="No van B.O. items. Upload a Van B.O. file in the Data page."
              />
            </div>
          </div>
        )
      )}

      {/* ═══ TRADE CUSTOMER MODAL ════════════════════════════════════════════ */}
      <Modal isOpen={!!selectedSalesman} onClose={() => { setSelectedSalesman(null); setSelectedCustomer(null); }} title={`${selectedSalesman?.name || ''} — Trade B.O.`}>
        {selectedSalesman && (
          <div>
            {!selectedCustomer ? (
              <>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trade B.O. (BSR)</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCurrency(selectedSalesman.bsr)}</div>
                      <div style={{ padding: '2px 8px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-danger)', fontSize: '12px', fontWeight: 700 }}>
                        {((selectedSalesman.stt + selectedSalesman.gsr + selectedSalesman.bsr) > 0 ? (selectedSalesman.bsr / (selectedSalesman.stt + selectedSalesman.gsr + selectedSalesman.bsr)) * 100 : 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customers</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>{filteredCustomers.length}</div>
                  </div>
                </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search customer..." value={custSearch} onChange={e => setCustSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 9px 7px 26px', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '12px' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select value={custProvince} onChange={e => { setCustProvince(e.target.value); setCustCity('all'); setCustBarangay('all'); }} style={{ ...selectStyle, flex: 1, minWidth: '100px' }}>
                  <option value="all">All Provinces</option>
                  {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={custCity} onChange={e => { setCustCity(e.target.value); setCustBarangay('all'); }} style={{ ...selectStyle, flex: 1, minWidth: '100px' }}>
                  <option value="all">All Cities</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={custBarangay} onChange={e => setCustBarangay(e.target.value)} style={{ ...selectStyle, flex: 1, minWidth: '100px' }}>
                  <option value="all">All Barangays</option>
                  {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            {custLoading ? (
              <div className="flex-center" style={{ height: '120px', color: 'var(--accent-primary)' }}><Loader2 size={24} className="animate-spin" /></div>
            ) : filteredCustomers.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No customers with BSR.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {filteredCustomers.map(c => (
                  <div key={c.id} className="interactive" onClick={() => setSelectedCustomer(c)}
                    style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {[c.barangay, c.city, c.province].filter(v => v && v !== '-').join(', ')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BSR</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCurrency(c.bsr)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>
            ) : (
              // Customer Details View
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button onClick={() => setSelectedCustomer(null)} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }} onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}>
                  <ArrowLeft size={14} /> Back to Customers
                </button>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>{selectedCustomer.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{selectedCustomer.id}</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-danger)', marginTop: '12px' }}>{formatCurrency(selectedCustomer.bsr)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Trade B.O.</div>
                </div>

                {/* BSR Category Chart */}
                {selectedCustomer.bsr_categories && Object.keys(selectedCustomer.bsr_categories).length > 0 && (
                  <div style={{ height: '240px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', flexShrink: 0 }}>Trade B.O. by Category</h3>
                    <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={Object.entries(selectedCustomer.bsr_categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)} margin={{ top: 5, right: 5, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickMargin={8} interval={0} angle={-45} textAnchor="end" height={40} />
                          <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={chartTooltipStyle.contentStyle} formatter={(val: any) => formatCurrency(val as number)} />
                          <Bar dataKey="value" fill="var(--accent-danger)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* BSR Products List */}
                {selectedCustomer.bsr_products && Object.keys(selectedCustomer.bsr_products).length > 0 && (
                  (() => {
                    const custCats = new Set<string>();
                    Object.keys(selectedCustomer.bsr_products).forEach(code => {
                      const cat = categoryMap[code];
                      if (cat) custCats.add(cat);
                    });
                    const availableCats = Array.from(custCats).sort();
                    
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <h3 style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Products</h3>
                        </div>
                        
                        {availableCats.length > 1 && (
                          <div style={{ marginBottom: '12px' }}>
                            <SlicerRow options={availableCats} selected={custProductCategory} onSelect={setCustProductCategory} label="Category" />
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(selectedCustomer.bsr_products)
                            .filter(([prodCode]) => custProductCategory === 'all' || categoryMap[prodCode] === custProductCategory)
                            .sort((a, b) => b[1] - a[1])
                            .map(([prodCode, value]) => (
                              <div key={prodCode} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {priceMap[prodCode]?.product_description || prodCode}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>{prodCode}</div>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-danger)', flexShrink: 0 }}>
                                  {formatCurrency(value)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BackOrder;
