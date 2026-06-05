import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useCustomersData } from '../../hooks/useCustomersData';
import { useTeams } from '../../hooks/useTeams';

const Customers: React.FC = () => {
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedBarangay, setSelectedBarangay] = useState('all');
  const [displayCount, setDisplayCount] = useState(20);
  const availableTeams = useTeams();
  
  const { loading, customers } = useCustomersData(selectedTeam);

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
      
      return matchesSearch && matchesTag && matchesProvince && matchesCity && matchesBarangay;
    });
  }, [customers, search, filterTag, selectedProvince, selectedCity, selectedBarangay]);

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
        <h2 style={{ width: '100%' }}>Customer Master List</h2>
        
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
    </div>
  );
};

export default Customers;
