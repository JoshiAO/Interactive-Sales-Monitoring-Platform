import React, { useState, useMemo, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Search, MapPin, UserRound, Package } from 'lucide-react';
import { useCustomersData } from '../../hooks/useCustomersData';
import { useTeams } from '../../hooks/useTeams';
import { useSalesmenList } from '../../hooks/useSalesmenList';
import { useUsersCache } from '../../hooks/useUsersCache';
import { Modal } from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

const Customers: React.FC = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [displayCount, setDisplayCount] = useState(20);
  const [selectedSalesmen, setSelectedSalesmen] = useState<string[]>([]);
  const [isSalesmanModalOpen, setIsSalesmanModalOpen] = useState(false);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  const [newCustomerOnly, setNewCustomerOnly] = useState(false);
  const [notInCmlOnly, setNotInCmlOnly] = useState(false);
  const [sssOnly, setSssOnly] = useState(false);
  const [coverageDay, setCoverageDay] = useState('all');
  const [wklyCoverage, setWklyCoverage] = useState('all');
  const [vd30DescMap, setVd30DescMap] = useState<Record<string, string>>({});
  const [vd30ProductsMap, setVd30ProductsMap] = useState<Record<string, Array<{ product_code: string; product_description: string; vd30_code: string }>>>({});
  const [selectedVdCell, setSelectedVdCell] = useState<{ customerId: string; fCode: string } | null>(null);
  const [vdScopeModal, setVdScopeModal] = useState<{
    customerName: string;
    customerId: string;
    fCode: string;
    vdFullCode: string;
    vdDescription: string;
    isBought: boolean;
    vd30Bought: string[];
    productSales?: Record<string, { volume: number; netValue: number }>;
    bsrProducts?: Record<string, number>;
  } | null>(null);
  const [vdScopeSearch, setVdScopeSearch] = useState('');
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);

  const availableTeams = useTeams();
  
  const { loading, customers } = useCustomersData(selectedTeam);
  const { salesmen } = useSalesmenList(selectedTeam);
  const { usersCache } = useUsersCache();

  useEffect(() => {
    const fetchVd30Ref = async () => {
      try {
        const snap = await getDoc(doc(db, 'reference_vd30', 'all'));
        if (snap.exists()) {
          const raw = snap.data();
          const descMap: Record<string, string> = {};
          const prodsMap: Record<string, Array<{ product_code: string; product_description: string; vd30_code: string }>> = {};

          Object.values(raw).forEach((item: any) => {
            const code = item.vd30_code;
            const desc = item.vd30_description || item.description || '';
            const pCode = item.product_code || item.id || '';
            const pDesc = item.product_description || item.name || 'No description';

            if (code) {
              const base = code.split('_')[0].toUpperCase();
              const full = code.toUpperCase();
              
              if (!descMap[base]) descMap[base] = desc;
              if (!descMap[full]) descMap[full] = desc;

              const pObj = { product_code: pCode, product_description: pDesc, vd30_code: code };

              if (!prodsMap[base]) prodsMap[base] = [];
              prodsMap[base].push(pObj);

              if (!prodsMap[full]) prodsMap[full] = [];
              prodsMap[full].push(pObj);
            }
          });

          setVd30DescMap(descMap);
          setVd30ProductsMap(prodsMap);
        }
      } catch (e) {
        console.error("Error loading reference_vd30:", e);
      }
    };
    fetchVd30Ref();
  }, []);

  const openVdScopeModal = (customer: any, fCode: string, isBought: boolean) => {
    const desc = vd30DescMap[fCode] || 'VD30 Placement Item';
    const prods = vd30ProductsMap[fCode] || [];
    const vdFullCode = prods.length > 0 ? (prods[0].vd30_code || fCode) : fCode;

    setVdScopeModal({
      customerName: customer.name,
      customerId: customer.id,
      fCode,
      vdFullCode,
      vdDescription: desc,
      isBought,
      vd30Bought: customer.vd30Bought || [],
      productSales: customer.productSales || customer.product_sales || {},
      bsrProducts: customer.bsr_products || {}
    });
    setVdScopeSearch('');
  };

  const handleCellTap = (customer: any, fCode: string, isBought: boolean, e: React.SyntheticEvent) => {
    const now = Date.now();
    const cellKey = `${customer.id}_${fCode}`;

    if (lastTapRef.current && lastTapRef.current.key === cellKey && (now - lastTapRef.current.time) < 300) {
      e.preventDefault();
      lastTapRef.current = null;
      openVdScopeModal(customer, fCode, isBought);
    } else {
      lastTapRef.current = { key: cellKey, time: now };
      setSelectedVdCell(prev => (prev?.customerId === customer.id && prev?.fCode === fCode) ? null : { customerId: customer.id, fCode });
    }
  };

  // Build salesman name lookup from usersCache (no extra reads)
  const salesmanNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    usersCache.forEach(u => {
      if (u.salesmanId && u.name) map[String(u.salesmanId)] = u.name;
    });
    return map;
  }, [usersCache]);

  const availableCoverageDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const availableWklyCoverage = ['W1&W3', 'W2&W4', 'WKLY'];

  const provinces = useMemo(() => Array.from(new Set(customers.map(c => c.province))).filter(Boolean).sort(), [customers]);
  const cities = useMemo(() => Array.from(new Set(customers.filter(c => selectedProvince === 'all' || c.province === selectedProvince).map(c => c.city))).filter(Boolean).sort(), [customers, selectedProvince]);
  const barangays = useMemo(() => Array.from(new Set(customers.filter(c => selectedCity === 'all' || c.city === selectedCity).map(c => c.barangay))).filter(Boolean).sort(), [customers, selectedCity]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const cName = c.name || '';
      const cId = String(c.id || '');
      const matchesSearch = cName.toLowerCase().includes(search.toLowerCase()) || cId.toLowerCase().includes(search.toLowerCase());
      const matchesTag = filterTag === 'all' ? true : filterTag === 'buying' ? c.isBuying : !c.isBuying;
      const matchesProvince = selectedProvince === 'all' || c.province === selectedProvince;
      const matchesCity = selectedCity === 'all' || c.city === selectedCity;
      const matchesBarangay = selectedBarangay === 'all' || c.barangay === selectedBarangay;
      const matchesSalesman = selectedSalesmen.length === 0 || selectedSalesmen.includes(c.salesmanId);
      const matchesNewCustomer = newCustomerOnly ? c.newCustomer : true;
      const matchesNotInCml = notInCmlOnly ? c.notInCml : true;
      const matchesSss = sssOnly ? c.isSariSariStore : true;
      const matchesCoverageDay = coverageDay === 'all' || c.coverageDay === coverageDay;
      const matchesWklyCoverage = wklyCoverage === 'all' || c.wklyCoverage === wklyCoverage;
      
      return matchesSearch && matchesTag && matchesProvince && matchesCity && matchesBarangay && matchesSalesman && matchesNewCustomer && matchesNotInCml && matchesSss && matchesCoverageDay && matchesWklyCoverage;
    });
  }, [customers, search, filterTag, selectedProvince, selectedCity, selectedBarangay, selectedSalesmen, newCustomerOnly, notInCmlOnly, sssOnly, coverageDay, wklyCoverage]);

  const totalBuying = useMemo(() => filteredCustomers.filter(c => c.isBuying).length, [filteredCustomers]);
  const totalNonBuying = useMemo(() => filteredCustomers.filter(c => !c.isBuying).length, [filteredCustomers]);
  const totalNewCustomer = useMemo(() => filteredCustomers.filter(c => c.newCustomer).length, [filteredCustomers]);
  const totalNotInCml = useMemo(() => filteredCustomers.filter(c => c.notInCml).length, [filteredCustomers]);

  const displayedCustomers = useMemo(() => filteredCustomers.slice(0, displayCount), [filteredCustomers, displayCount]);

  if (loading && customers.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', flex: 1 }}>
          <h2 style={{ margin: 0 }}>Customer Master List</h2>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ color: 'var(--accent-success)' }}>{totalBuying.toLocaleString()} Buying</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--accent-danger)' }}>{totalNonBuying.toLocaleString()} Non-Buying</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--accent-success)' }}>{totalNewCustomer.toLocaleString()} New Customer</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: '#f59e0b' }}>{totalNotInCml.toLocaleString()} Not in CML</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: sssOnly ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: sssOnly ? 600 : 400 }}>SSS Stores</span>
            <div 
              onClick={() => { setSssOnly(!sssOnly); setDisplayCount(20); }}
              style={{ width: '36px', height: '20px', borderRadius: '10px', background: sssOnly ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: sssOnly ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New Customers</span>
            <div 
              onClick={() => { setNewCustomerOnly(!newCustomerOnly); setDisplayCount(20); }}
              style={{ width: '36px', height: '20px', borderRadius: '10px', background: newCustomerOnly ? 'var(--accent-success)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: newCustomerOnly ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not in CML</span>
            <div 
              onClick={() => { setNotInCmlOnly(!notInCmlOnly); setDisplayCount(20); }}
              style={{ width: '36px', height: '20px', borderRadius: '10px', background: notInCmlOnly ? '#f59e0b' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: notInCmlOnly ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </div>
          {role !== 'salesman' && (
            <button 
              className="btn btn-primary"
              onClick={() => setIsSalesmanModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Search size={16} /> Filter by Salesman {selectedSalesmen.length > 0 ? `(${selectedSalesmen.length})` : ''}
            </button>
          )}
        </div>
        
        <div className="filters-grid" style={{ width: '100%' }}>
          {/* Search Code/Name */}
          <div className="search-bar" style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search code or name..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setDisplayCount(20); }}
              style={{ paddingLeft: '40px', width: '100%' }}
            />
          </div>

          {/* Tags */}
          <select 
            className="glass-panel" 
            style={{ padding: '12px 16px', borderRadius: '8px', width: '100%' }}
            value={filterTag}
            onChange={e => { setFilterTag(e.target.value); setDisplayCount(20); }}
          >
            <option value="all">All Tags</option>
            <option value="buying">Buying</option>
            <option value="non-buying">Non-Buying</option>
          </select>

          {/* Geographic Filters */}
          <select 
            value={selectedProvince}
            onChange={(e) => { 
              setSelectedProvince(e.target.value); 
              setSelectedCity('all'); 
              setSelectedBarangay('all'); 
              setDisplayCount(20); 
            }}
            className="glass-panel" 
            style={{ padding: '12px 16px', borderRadius: '8px', width: '100%' }}
          >
            <option value="all">All Provinces</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <select 
            value={selectedCity}
            onChange={(e) => { 
              setSelectedCity(e.target.value); 
              setSelectedBarangay('all'); 
              setDisplayCount(20); 
            }}
            disabled={selectedProvince === 'all'}
            className="glass-panel" 
            style={{ padding: '12px 16px', borderRadius: '8px', opacity: selectedProvince === 'all' ? 0.5 : 1, cursor: selectedProvince === 'all' ? 'not-allowed' : 'pointer', width: '100%' }}
          >
            <option value="all">{selectedProvince === 'all' ? 'Select Province First' : 'All Cities'}</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={selectedBarangay}
            onChange={(e) => { 
              setSelectedBarangay(e.target.value); 
              setDisplayCount(20); 
            }}
            disabled={selectedCity === 'all'}
            className="glass-panel" 
            style={{ padding: '12px 16px', borderRadius: '8px', opacity: selectedCity === 'all' ? 0.5 : 1, cursor: selectedCity === 'all' ? 'not-allowed' : 'pointer', width: '100%' }}
          >
            <option value="all">{selectedCity === 'all' ? 'Select City First' : 'All Barangays'}</option>
            {barangays.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Slicer Group Row */}
        <div className="hide-scrollbar" style={{ width: '100%', overflowX: 'auto', marginTop: '16px', paddingTop: '12px' }}>
          <div style={{ display: 'flex', minWidth: '100%', width: 'max-content', borderTop: '1px solid var(--border)', paddingTop: '16px', gap: '16px', paddingBottom: '8px' }}>
            
            {/* Team Slicer */}
            {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingRight: '16px', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                {selectedTeam !== 'all' && (
                  <div style={{ position: 'absolute', top: '-26px', right: '16px', padding: '0 4px', zIndex: 10 }}>
                    <button onClick={() => { setSelectedTeam('all'); setDisplayCount(20); }} style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>Clear</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {availableTeams.map(t => (
                    <button
                      key={t}
                      onClick={() => { setSelectedTeam(selectedTeam === t ? 'all' : t); setDisplayCount(20); }}
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
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>Team</div>
              </div>
            )}

            {/* Coverage Day Slicer */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingRight: '16px', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)', padding: '0 8px', borderRadius: '8px', flexShrink: 0 }}>
              {coverageDay !== 'all' && (
                <div style={{ position: 'absolute', top: '-26px', right: '16px', padding: '0 4px', zIndex: 10 }}>
                  <button onClick={() => { setCoverageDay('all'); setDisplayCount(20); }} style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>Clear</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {availableCoverageDays.map(d => (
                  <button
                    key={d}
                    onClick={() => { setCoverageDay(coverageDay === d ? 'all' : d); setDisplayCount(20); }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid',
                      borderColor: coverageDay === d ? 'var(--accent-primary)' : 'var(--border)',
                      backgroundColor: coverageDay === d ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                      color: coverageDay === d ? '#fff' : 'var(--text-muted)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>Coverage Day</div>
            </div>

            {/* Wkly Coverage Slicer */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0 8px', borderRadius: '8px', flexShrink: 0 }}>
              {wklyCoverage !== 'all' && (
                <div style={{ position: 'absolute', top: '-26px', right: '16px', padding: '0 4px', zIndex: 10 }}>
                  <button onClick={() => { setWklyCoverage('all'); setDisplayCount(20); }} style={{ color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '12px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}>Clear</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                {availableWklyCoverage.map(w => (
                  <button
                    key={w}
                    onClick={() => { setWklyCoverage(wklyCoverage === w ? 'all' : w); setDisplayCount(20); }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '16px',
                      border: '1px solid',
                      borderColor: wklyCoverage === w ? 'var(--accent-primary)' : 'var(--border)',
                      backgroundColor: wklyCoverage === w ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                      color: wklyCoverage === w ? '#fff' : 'var(--text-muted)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>Weekly Coverage</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {displayedCustomers.map(customer => (
          <div key={customer.id} className="glass-panel interactive" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '16px', margin: 0 }}>{customer.name}</h3>
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    borderRadius: '12px', 
                    backgroundColor: customer.isBuying ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: customer.isBuying ? 'var(--accent-success)' : 'var(--accent-danger)'
                  }}>
                    {customer.isBuying ? 'Buying' : 'Non-Buying'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{customer.id}</span>
                  <span>•</span>
                  <MapPin size={12} />
                  <span>{customer.barangay}, {customer.city}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                    color: 'var(--accent-primary)', 
                    fontSize: '10px', 
                    fontWeight: 600, 
                    padding: '1px 6px', 
                    borderRadius: '4px', 
                    border: '1px solid rgba(59, 130, 246, 0.2)' 
                  }}>
                    {customer.partyClassificationDescription || customer.customerClass || 'Party Class N/A'}
                  </span>
                </div>
                {role !== 'salesman' && customer.salesmanId && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <UserRound size={11} />
                    <span>{customer.salesmanId}{salesmanNameMap[customer.salesmanId] ? ` — ${salesmanNameMap[customer.salesmanId]}` : ''}</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {customer.notInCml && (
                  <div style={{ 
                    backgroundColor: '#f59e0b', 
                    color: 'white', 
                    fontSize: '10px', 
                    fontWeight: 'bold', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                  }}>
                    NOT IN CML
                  </div>
                )}
                {customer.newCustomer && (
                  <div style={{ 
                    backgroundColor: 'var(--accent-success)', 
                    color: 'white', 
                    fontSize: '10px', 
                    fontWeight: 'bold', 
                    padding: '4px 12px', 
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                  }}>
                    NEW
                  </div>
                )}
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Volume</div>
                <div style={{ fontWeight: 600 }}>{customer.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CS</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Value</div>
                <div style={{ fontWeight: 600 }}>₱{customer.netValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GSR</div>
                <div style={{ fontWeight: 600 }}>₱{customer.gsr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BSR</div>
                <div style={{ fontWeight: 600 }}>₱{customer.bsr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            {sssOnly && (() => {
              const isSmallStore = customer.isSmallSariSariStore || (customer.partyClassificationDescription || '').toLowerCase().includes('small');
              const vdCount = isSmallStore ? 19 : 30;
              const vdMaxStr = vdCount.toString().padStart(2, '0');

              return (
                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span>VD Core Status (01–{vdMaxStr}) <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 500, marginLeft: '4px' }}>(Click cell for info • Double-click for scope)</span></span>
                    <span style={{ fontSize: '10px', color: 'var(--accent-success)', fontWeight: 700 }}>
                      {Array.from({ length: vdCount }, (_, i) => String(i + 1).padStart(2, '0')).filter(num => {
                        const fCode = 'F' + num;
                        return Array.isArray(customer.vd30Bought) && customer.vd30Bought.some((b: string) => String(b).toUpperCase().startsWith(fCode));
                      }).length} / {vdCount} Bought
                    </span>
                  </div>

                  {/* Single Tap Inline Info Banner */}
                  {selectedVdCell && selectedVdCell.customerId === customer.id && (() => {
                    const fCode = selectedVdCell.fCode;
                    const desc = vd30DescMap[fCode] || 'VD30 Core Item';
                    const prods = vd30ProductsMap[fCode] || [];
                    const fullCode = prods.length > 0 ? prods[0].vd30_code : fCode;
                    const isBought = Array.isArray(customer.vd30Bought) && customer.vd30Bought.some((b: string) => String(b).toUpperCase().startsWith(fCode));

                    return (
                      <div 
                        className="animate-fade-in"
                        style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                          padding: '8px 12px', borderRadius: '8px', 
                          backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)',
                          margin: '2px 0 4px' 
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', color: 'var(--accent-primary)', flexShrink: 0 }}>
                            {fullCode}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {desc}
                          </span>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', flexShrink: 0,
                            backgroundColor: isBought ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: isBought ? 'var(--accent-success)' : 'var(--accent-danger)'
                          }}>
                            {isBought ? 'Bought' : 'Not Bought'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Double-tap for products</span>
                          <button
                            onClick={() => openVdScopeModal(customer, fCode, isBought)}
                            style={{
                              padding: '3px 8px', borderRadius: '6px', border: 'none',
                              backgroundColor: 'var(--accent-primary)', color: '#fff',
                              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Package size={12} /> Scope ({prods.length})
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="hide-scrollbar" style={{ display: 'flex', gap: '3px', overflowX: 'auto', width: '100%', paddingBottom: '4px' }}>
                    {Array.from({ length: vdCount }, (_, i) => String(i + 1).padStart(2, '0')).map(num => {
                    const fCode = 'F' + num;
                    const desc = vd30DescMap[fCode] || '';
                    const isBought = Array.isArray(customer.vd30Bought) && customer.vd30Bought.some((b: string) => String(b).toUpperCase().startsWith(fCode));
                    const isSelectedCell = selectedVdCell?.customerId === customer.id && selectedVdCell?.fCode === fCode;

                    return (
                      <div
                        key={num}
                        title={`${fCode}${desc ? `: ${desc}` : ''} — ${isBought ? 'Bought' : 'Not Bought'} (Double-tap to view products)`}
                        onClick={(e) => handleCellTap(customer, fCode, isBought, e)}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          openVdScopeModal(customer, fCode, isBought);
                        }}
                        style={{
                          flex: '1 0 auto',
                          minWidth: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          backgroundColor: isBought ? 'var(--accent-success)' : 'rgba(255, 255, 255, 0.06)',
                          color: isBought ? '#ffffff' : 'var(--text-muted)',
                          border: isSelectedCell ? '2px solid var(--accent-primary)' : `1px solid ${isBought ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelectedCell ? '0 0 8px var(--accent-primary)' : isBought ? '0 1px 4px rgba(16, 185, 129, 0.3)' : 'none',
                          transform: isSelectedCell ? 'scale(1.1)' : 'scale(1)'
                        }}
                      >
                        {num}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </div>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="flex-center" style={{ height: '200px', color: 'var(--text-muted)' }}>
            No customers found matching the filters.
          </div>
        )}

        {displayCount < filteredCustomers.length && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <button 
              className="btn glass-panel"
              style={{ padding: '12px 24px', cursor: 'pointer' }}
              onClick={() => setDisplayCount(prev => prev + 20)}
            >
              Load More Customers ({filteredCustomers.length - displayCount} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Salesman Filter Modal */}
      <Modal 
        isOpen={isSalesmanModalOpen} 
        onClose={() => setIsSalesmanModalOpen(false)} 
        title="Filter by Salesman"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="search-bar" style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search code or name..." 
              value={salesmanSearch}
              onChange={e => setSalesmanSearch(e.target.value)}
              style={{ paddingLeft: '40px', width: '100%' }}
            />
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px' }}>
            {salesmen.filter(s => s.name.toLowerCase().includes(salesmanSearch.toLowerCase()) || s.code.toLowerCase().includes(salesmanSearch.toLowerCase())).map(s => (
              <label key={s.code} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedSalesmen.includes(s.code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSalesmen(prev => [...prev, s.code]);
                    } else {
                      setSelectedSalesmen(prev => prev.filter(code => code !== s.code));
                    }
                    setDisplayCount(20);
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.code}</span>
                </div>
              </label>
            ))}
            {salesmen.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No salesmen found.</div>}
          </div>

          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              className="btn glass-panel" 
              onClick={() => { setSelectedSalesmen([]); setDisplayCount(20); }}
              style={{ padding: '8px 16px' }}
            >
              Clear All
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => setIsSalesmanModalOpen(false)}
              style={{ padding: '8px 24px' }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Modal>

      {/* VD Group Product Scope Modal */}
      <Modal
        isOpen={!!vdScopeModal}
        onClose={() => setVdScopeModal(null)}
        title={vdScopeModal?.vdFullCode || vdScopeModal?.fCode || ''}
      >
        {vdScopeModal && (() => {
          const prods = vd30ProductsMap[vdScopeModal.fCode] || [];
          const filteredProds = prods.filter(p => 
            !vdScopeSearch || 
            p.product_code.toLowerCase().includes(vdScopeSearch.toLowerCase()) || 
            p.product_description.toLowerCase().includes(vdScopeSearch.toLowerCase())
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                  {vdScopeModal.vdDescription}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Customer: <strong style={{ color: 'var(--text-main)' }}>{vdScopeModal.customerName}</strong> ({vdScopeModal.customerId})
                </div>
              </div>

              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search product code or description..." 
                  value={vdScopeSearch}
                  onChange={e => setVdScopeSearch(e.target.value)}
                  style={{ paddingLeft: '32px', width: '100%', padding: '6px 12px 6px 32px', fontSize: '12px', borderRadius: '6px' }}
                />
              </div>

              {/* Product Scope List */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} />
                  Products in Scope ({filteredProds.length})
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredProds.length > 0 ? (
                    filteredProds.map((prod, idx) => {
                      const pCode = String(prod.product_code).trim();
                      const vCode = String(prod.vd30_code).trim().toUpperCase();

                      const pSales = vdScopeModal.productSales?.[pCode];
                      const pVolume = pSales?.volume || 0;
                      const pNetValue = pSales?.netValue || 0;

                      // Determine if THIS SPECIFIC product was bought by the customer (formula: >= 1)
                      const isSpecificItemBought = (() => {
                        if (pSales !== undefined) {
                          return (pSales.netValue >= 1 || pSales.volume >= 1);
                        }
                        if (Array.isArray(vdScopeModal.vd30Bought)) {
                          return vdScopeModal.vd30Bought.some((b: string) => {
                            const bUpper = String(b).toUpperCase();
                            return bUpper === vCode || bUpper.endsWith(`_${pCode}`);
                          });
                        }
                        return false;
                      })();

                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            padding: '10px 12px', 
                            background: isSpecificItemBought ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.03)', 
                            borderRadius: '6px', 
                            border: `1px solid ${isSpecificItemBought ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}` 
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden', paddingRight: '8px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {prod.product_code}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: 1.3 }}>
                              {prod.product_description}
                            </span>
                            {isSpecificItemBought && (
                              <div style={{ fontSize: '11px', color: 'var(--accent-success)', display: 'flex', gap: '12px', marginTop: '2px', fontWeight: 600 }}>
                                <span>Vol: {pVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CS</span>
                                <span>Net: ₱{pNetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>

                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', flexShrink: 0,
                            backgroundColor: isSpecificItemBought ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSpecificItemBought ? 'var(--accent-success)' : 'var(--text-muted)',
                            border: `1px solid ${isSpecificItemBought ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`
                          }}>
                            {isSpecificItemBought ? 'Bought' : 'In Scope'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No products found matching search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default Customers;
