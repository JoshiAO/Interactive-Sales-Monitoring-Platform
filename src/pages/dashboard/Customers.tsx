import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useCustomersData } from '../../hooks/useCustomersData';
import { useTeams } from '../../hooks/useTeams';
import { useSalesmenList } from '../../hooks/useSalesmenList';

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
  const availableTeams = useTeams();
  
  const { loading, customers } = useCustomersData(selectedTeam);
  const { salesmen } = useSalesmenList(selectedTeam);

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
      
      return matchesSearch && matchesTag && matchesProvince && matchesCity && matchesBarangay && matchesSalesman;
    });
  }, [customers, search, filterTag, selectedProvince, selectedCity, selectedBarangay, selectedSalesmen]);

  const totalBuying = useMemo(() => filteredCustomers.filter(c => c.isBuying).length, [filteredCustomers]);
  const totalNonBuying = useMemo(() => filteredCustomers.filter(c => !c.isBuying).length, [filteredCustomers]);

  const displayedCustomers = useMemo(() => filteredCustomers.slice(0, displayCount), [filteredCustomers, displayCount]);

  if (loading) {
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

        {/* Team Slicer */}
        {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', width: '100%', marginTop: '16px' }}>
            {availableTeams.map(t => (
              <button
                key={t}
                onClick={() => { setSelectedTeam(t); setDisplayCount(20); }}
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
                onClick={() => { setSelectedTeam('all'); setDisplayCount(20); }}
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
      {isSalesmanModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Filter by Salesman</h3>
              <button onClick={() => setIsSalesmanModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
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
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

            <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        </div>
      )}
    </div>
  );
};

export default Customers;
