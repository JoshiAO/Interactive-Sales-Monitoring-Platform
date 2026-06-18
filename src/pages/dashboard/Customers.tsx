import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, MapPin, Loader2, UserRound } from 'lucide-react';
import { useCustomersData } from '../../hooks/useCustomersData';
import { useTeams } from '../../hooks/useTeams';
import { useSalesmenList } from '../../hooks/useSalesmenList';
import { useUsersCache } from '../../hooks/useUsersCache';
import { Modal } from '../../components/ui/Modal';

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
  const [coverageDay, setCoverageDay] = useState('all');
  const [wklyCoverage, setWklyCoverage] = useState('all');
  const availableTeams = useTeams();
  
  const { loading, customers } = useCustomersData(selectedTeam);
  const { salesmen } = useSalesmenList(selectedTeam);
  const { usersCache } = useUsersCache();

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
      const matchesCoverageDay = coverageDay === 'all' || c.coverageDay === coverageDay;
      const matchesWklyCoverage = wklyCoverage === 'all' || c.wklyCoverage === wklyCoverage;
      
      return matchesSearch && matchesTag && matchesProvince && matchesCity && matchesBarangay && matchesSalesman && matchesNewCustomer && matchesCoverageDay && matchesWklyCoverage;
    });
  }, [customers, search, filterTag, selectedProvince, selectedCity, selectedBarangay, selectedSalesmen, newCustomerOnly, coverageDay, wklyCoverage]);

  const totalBuying = useMemo(() => filteredCustomers.filter(c => c.isBuying).length, [filteredCustomers]);
  const totalNonBuying = useMemo(() => filteredCustomers.filter(c => !c.isBuying).length, [filteredCustomers]);
  const totalNewCustomer = useMemo(() => filteredCustomers.filter(c => c.newCustomer).length, [filteredCustomers]);

  const displayedCustomers = useMemo(() => filteredCustomers.slice(0, displayCount), [filteredCustomers, displayCount]);

  if (loading && customers.length === 0) {
    return (
      <div className="flex-center" style={{ height: '50vh', color: 'var(--accent-primary)' }}>
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
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
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>New Customers</span>
            <div 
              onClick={() => { setNewCustomerOnly(!newCustomerOnly); setDisplayCount(20); }}
              style={{ width: '36px', height: '20px', borderRadius: '10px', background: newCustomerOnly ? 'var(--accent-success)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: newCustomerOnly ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
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
                {role !== 'salesman' && customer.salesmanId && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <UserRound size={11} />
                    <span>{customer.salesmanId}{salesmanNameMap[customer.salesmanId] ? ` — ${salesmanNameMap[customer.salesmanId]}` : ''}</span>
                  </div>
                )}
              </div>
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
    </div>
  );
};

export default Customers;
