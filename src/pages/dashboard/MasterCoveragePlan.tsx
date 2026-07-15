import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useCustomersData } from '../../hooks/useCustomersData';
import MasterCoveragePlanWheel from '../../components/mcp/MasterCoveragePlanWheel';
import MasterCoveragePlanTable from '../../components/mcp/MasterCoveragePlanTable';
import CityMapBackground from '../../components/mcp/CityMapBackground';
import { extractAllTownCoordinates } from '../../components/mcp/nuevaEcijaCoordinates';
import { Filter, Users } from 'lucide-react';

const MasterCoveragePlan: React.FC = () => {
  const { role, salesmanId } = useAuth();
  
  // Slicers
  const [selectedServiceModel, setSelectedServiceModel] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  
  // Table filters
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [selectedWeek, setSelectedWeek] = useState<string>('W1&W3');
  
  // We no longer need the useEffect that sets state.
  // Instead we derive it directly in the render cycle or conditionally render.
  
  // Selection state
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string | null>(() => {
    if (role === 'salesman') return String(salesmanId);
    return sessionStorage.getItem('mcp_selectedSalesmanId') || null;
  });
  const [showTable, setShowTable] = useState<boolean>(role === 'salesman');

  useEffect(() => {
    if (selectedSalesmanId && role !== 'salesman') {
      sessionStorage.setItem('mcp_selectedSalesmanId', selectedSalesmanId);
    }
  }, [selectedSalesmanId, role]);
  
  // Track active centered wheel item for background
  const [activeSalesman, setActiveSalesman] = useState<any>(null);
  
  // Track selected city for map zoom
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Clear selected city when changing salesman
  useEffect(() => {
    setSelectedCity(null);
  }, [activeSalesman]);

  const { data: dashboardData, loading: dashboardLoading } = useDashboardData('all', false);
  const salesmen = dashboardData.salesmen;
  const { customers, loading: customersLoading } = useCustomersData('all'); // Load all customers initially or based on selected team

  // Filter salesmen based on Service Model and Team
  const filteredSalesmen = useMemo(() => {
    return salesmen.filter(s => {
      if (selectedServiceModel !== 'all' && s.type !== selectedServiceModel) return false;
      if (selectedTeam !== 'all' && s.team !== selectedTeam) return false;
      return true;
    }).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  }, [salesmen, selectedServiceModel, selectedTeam]);

  // Extract unique service models for slicer
  const uniqueServiceModels = useMemo(() => {
    const models = new Set<string>();
    salesmen.forEach(s => {
      if (s.type && s.type !== 'Unknown') models.add(s.type);
    });
    return ['all', ...Array.from(models).sort()];
  }, [salesmen]);

  // Extract unique teams for slicer
  const uniqueTeams = useMemo(() => {
    const teams = new Set<string>();
    salesmen.forEach(s => {
      if (s.team) teams.add(s.team);
    });
    return ['all', ...Array.from(teams).sort()];
  }, [salesmen]);

  const isLoading = dashboardLoading || customersLoading;
  const isInitialLoad = isLoading && salesmen.length === 0;

  if (isInitialLoad) {
    return (
      <div className="flex-center" style={{ height: '100%', width: '100%', flexDirection: 'column', gap: '16px' }}>
        <div className="loading-spinner"></div>
        <div style={{ color: 'var(--text-muted)' }}>Loading Master Coverage Plan...</div>
      </div>
    );
  }

  // Get the actual selected salesman object
  const selectedSalesman = salesmen.find(s => s.id === selectedSalesmanId);

  // Return exactly the table if role is salesman
  if (role === 'salesman' && selectedSalesman) {
    return (
      <MasterCoveragePlanTable
        salesman={selectedSalesman}
        customers={customers}
        selectedDay={selectedDay}
        selectedWeek={selectedWeek}
        onDayChange={setSelectedDay}
        onWeekChange={setSelectedWeek}
        onBack={() => setShowTable(false)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* Show a subtle loading indicator during filter changes */}
      {isLoading && !isInitialLoad && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 100,
          background: 'rgba(15, 23, 42, 0.8)', padding: '8px 16px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
          <span style={{ fontSize: '12px', color: '#60A5FA', fontWeight: 500 }}>Updating Map...</span>
        </div>
      )}
      
      {!showTable ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
          
          {/* Holographic 3D Map Overlay with Real Map Provider */}
          {activeSalesman?.towns && activeSalesman.towns.length > 0 && (
            <>
              <CityMapBackground towns={activeSalesman.towns} selectedCity={selectedCity} />
              
              {/* Floating Interactive City List (Above the map) */}
              {extractAllTownCoordinates(activeSalesman.towns).length > 1 && (
                <div style={{
                  position: 'absolute',
                  right: '24px', 
                  top: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '8px',
                  zIndex: 20,
                  pointerEvents: 'auto',
                  maxHeight: 'calc(100vh - 160px)',
                  overflowY: 'auto'
                }}>
                  <div 
                    onClick={() => setSelectedCity(null)}
                    style={{
                      padding: '8px 12px',
                      color: selectedCity === null ? '#FFFFFF' : '#94A3B8',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontWeight: selectedCity === null ? 700 : 500,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                    }}
                  >
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: selectedCity === null ? '#60A5FA' : 'transparent',
                      boxShadow: selectedCity === null ? '0 0 10px #60A5FA' : 'none'
                    }} />
                    View All Cities
                  </div>

                  {extractAllTownCoordinates(activeSalesman.towns).map(tc => (
                    <div 
                      key={tc.name}
                      onClick={() => setSelectedCity(tc.name)}
                      style={{
                        padding: '8px 12px',
                        color: selectedCity === tc.name ? '#FFFFFF' : '#94A3B8',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontWeight: selectedCity === tc.name ? 700 : 500,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                      }}
                    >
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: selectedCity === tc.name ? '#60A5FA' : 'transparent',
                        boxShadow: selectedCity === tc.name ? '0 0 10px #60A5FA' : 'none'
                      }} />
                      {tc.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Top Bar / Slicers */}
          <div style={{ 
            marginBottom: '32px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            position: 'relative',
            zIndex: 10
          }}>
            <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: '28px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Master Coverage Plan
            </h1>
            
            <div style={{ display: 'flex', gap: '16px', pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              
              {/* Service Model Slicer */}
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px', gap: '4px', borderRadius: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', color: 'var(--text-muted)' }}>
                  <Filter size={14} />
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {uniqueServiceModels.map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedServiceModel(m)}
                      style={{
                        background: selectedServiceModel === m ? 'var(--primary-color)' : 'transparent',
                        color: selectedServiceModel === m ? '#FFF' : 'var(--text-muted)',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: selectedServiceModel === m ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: selectedServiceModel === m ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none'
                      }}
                    >
                      {m === 'all' ? 'All' : m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teams Slicer */}
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '4px', gap: '4px', borderRadius: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', color: 'var(--text-muted)' }}>
                  <Users size={14} />
                  <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {uniqueTeams.map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTeam(t);
                        setSelectedSalesmanId(null);
                      }}
                      style={{
                        background: selectedTeam === t ? 'var(--primary-color)' : 'transparent',
                        color: selectedTeam === t ? '#FFF' : 'var(--text-muted)',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: selectedTeam === t ? 600 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: selectedTeam === t ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                        textTransform: 'capitalize'
                      }}
                    >
                      {t === 'all' ? 'All' : t.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Wheel Selector */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, width: '100%' }}>
            {filteredSalesmen.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '18px', margin: 'auto' }}>
                No salesmen found for the selected filters.
              </div>
            ) : (
              <MasterCoveragePlanWheel 
                salesmen={filteredSalesmen}
                selectedSalesmanId={selectedSalesmanId}
                onActiveChange={(salesman) => {
                  setActiveSalesman(salesman);
                  if (selectedSalesmanId !== salesman.id) {
                    setSelectedSalesmanId(salesman.id);
                  }
                }}
                onSelect={(id) => {
                  if (selectedSalesmanId === id) {
                    // Double click or click when already selected -> open table
                    setShowTable(true);
                  } else {
                    setSelectedSalesmanId(id);
                  }
                }}
              />
            )}
          </div>

        </div>
      ) : (
        <>
          <div style={{ padding: '0 0 16px 0' }}>
            <button 
              className="btn" 
              onClick={() => setShowTable(false)}
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
            >
              &larr; Back to Salesman Selection
            </button>
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {selectedSalesman ? (
              <MasterCoveragePlanTable
                salesman={selectedSalesman}
                customers={customers}
                selectedDay={selectedDay}
                selectedWeek={selectedWeek}
                onDayChange={setSelectedDay}
                onWeekChange={setSelectedWeek}
              />
            ) : (
              <div style={{ color: 'var(--accent-error)' }}>Error: Salesman not found.</div>
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default MasterCoveragePlan;
