import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Modal } from '../../components/ui/Modal';

export interface RoleAccess {
  read: boolean;
  edit: boolean;
}

export interface PageSetting {
  id: string;
  name: string;
  group: 'DATA VIEW' | 'LOGISTICS & DELIVERY' | 'ADMIN';
  visible: boolean;
  roles: Record<string, RoleAccess>;
}

export const ALL_ROLES = [
  'admin', 'manager', 'supervisor', 'salesman', 'warehouse_supervisor', 'delivery_team', 'encoder'
];

export const DEFAULT_PAGES: PageSetting[] = [
  // DATA VIEW
  { id: 'home', name: 'Home (Dashboard)', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'sales', name: 'Sales', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'vd30', name: 'VD30', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'customers', name: 'Customers', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'npd', name: 'NPD & Promo', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'mcp', name: 'Master Coverage Plan (MCP)', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'ageing', name: 'Ageing', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false } } },
  { id: 'bo', name: 'B.O.', group: 'DATA VIEW', visible: true, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'performance', name: 'Gamification', group: 'DATA VIEW', visible: false, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  { id: 'incentives', name: 'Incentives', group: 'DATA VIEW', visible: false, roles: { admin: { read: true, edit: false }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, salesman: { read: true, edit: false } } },
  
  // LOGISTICS & DELIVERY
  { id: 'logistics_manning', name: 'Manning', group: 'LOGISTICS & DELIVERY', visible: true, roles: { admin: { read: true, edit: true }, warehouse_supervisor: { read: true, edit: true } } },
  { id: 'logistics_schedule', name: 'Schedule', group: 'LOGISTICS & DELIVERY', visible: true, roles: { admin: { read: true, edit: true }, warehouse_supervisor: { read: true, edit: true }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, encoder: { read: true, edit: true } } },
  { id: 'logistics_deliveries', name: 'Deliveries', group: 'LOGISTICS & DELIVERY', visible: true, roles: { admin: { read: true, edit: true }, warehouse_supervisor: { read: true, edit: true }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, encoder: { read: true, edit: false }, salesman: { read: true, edit: false }, delivery_team: { read: true, edit: true } } },
  { id: 'logistics_picklist', name: 'Picklist', group: 'LOGISTICS & DELIVERY', visible: true, roles: { admin: { read: true, edit: true }, warehouse_supervisor: { read: true, edit: true }, manager: { read: true, edit: false }, encoder: { read: true, edit: true } } },
  { id: 'logistics_ddrms', name: 'DDRMS', group: 'LOGISTICS & DELIVERY', visible: true, roles: { admin: { read: true, edit: true }, warehouse_supervisor: { read: true, edit: true }, manager: { read: true, edit: false }, supervisor: { read: true, edit: false }, encoder: { read: true, edit: true }, salesman: { read: true, edit: false }, delivery_team: { read: true, edit: false } } },
  
  // ADMIN
  { id: 'data_management', name: 'Data Management', group: 'ADMIN', visible: true, roles: { admin: { read: true, edit: true } } },
  { id: 'users', name: 'Users', group: 'ADMIN', visible: true, roles: { admin: { read: true, edit: true } } },
];

export const UISettingsTab: React.FC = () => {
  const [pages, setPages] = useState<PageSetting[]>(DEFAULT_PAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedPage, setSelectedPage] = useState<PageSetting | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'ui'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().pages) {
        // Merge with defaults to ensure new pages are picked up
        const dbPages = docSnap.data().pages as PageSetting[];
        const merged = DEFAULT_PAGES.map(dp => {
          const found = dbPages.find(p => p.id === dp.id);
          return found ? { ...dp, ...found } : dp;
        });
        setPages(merged);
      } else {
        setPages(DEFAULT_PAGES);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleGlobalVisible = async (pageId: string) => {
    const updated = pages.map(p => p.id === pageId ? { ...p, visible: !p.visible } : p);
    setPages(updated);
    
    // Save to Firestore immediately
    try {
      await setDoc(doc(db, 'settings', 'ui'), { pages: updated }, { merge: true });
    } catch (e: any) {
      alert('Failed to save visibility toggle: ' + e.message);
    }
  };

  const handleSaveModalSettings = async () => {
    if (!selectedPage) return;
    setSaving(true);
    
    const updated = pages.map(p => p.id === selectedPage.id ? selectedPage : p);
    setPages(updated);
    
    try {
      await setDoc(doc(db, 'settings', 'ui'), { pages: updated }, { merge: true });
      setSelectedPage(null);
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = (role: string, type: 'read' | 'edit') => {
    if (!selectedPage) return;
    const currentRoles = { ...selectedPage.roles };
    
    if (!currentRoles[role]) {
      currentRoles[role] = { read: false, edit: false };
    }
    
    currentRoles[role][type] = !currentRoles[role][type];
    
    // If edit is true, force read to true
    if (type === 'edit' && currentRoles[role].edit) {
      currentRoles[role].read = true;
    }
    
    // If read is false, force edit to false
    if (type === 'read' && !currentRoles[role].read) {
      currentRoles[role].edit = false;
    }
    
    setSelectedPage({ ...selectedPage, roles: currentRoles });
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={24} className="animate-spin" /></div>;
  }

  const grouped = pages.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {} as Record<string, PageSetting[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {['DATA VIEW', 'LOGISTICS & DELIVERY'].map(groupName => {
        if (!grouped[groupName]) return null;
        return (
          <div key={groupName} className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '15px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{groupName}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {grouped[groupName].map(page => (
                <div 
                  key={page.id} 
                  style={{ 
                    border: '1px solid var(--border)', 
                    borderRadius: '12px', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: page.visible ? 1 : 0.6
                  }}
                  onClick={() => setSelectedPage(page)}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>{page.name}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggleGlobalVisible(page.id); }}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer',
                        color: page.visible ? 'var(--accent-success)' : 'var(--text-muted)',
                        padding: '4px'
                      }}
                      title={page.visible ? "Page is visible. Click to disable." : "Page is disabled. Click to enable."}
                    >
                      {page.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Allowed Roles: {Object.keys(page.roles).filter(r => page.roles[r].read).join(', ') || 'None'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Modal isOpen={!!selectedPage} onClose={() => setSelectedPage(null)} title={`UI Settings: ${selectedPage?.name}`} maxWidth="700px">
        {selectedPage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Global Visibility</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>If disabled, this page will show an 'Under Development' screen to everyone, except Admin who can still see the sidebar link.</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedPage.visible} 
                  onChange={() => setSelectedPage({ ...selectedPage, visible: !selectedPage.visible })}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 600, color: selectedPage.visible ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                  {selectedPage.visible ? 'Visible' : 'Disabled'}
                </span>
              </label>
            </div>

            <div>
              <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--accent-primary)' }}>Role Based Access</h4>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Role</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Can Read (Visible in Sidebar)</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Can Edit (Write Access)</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_ROLES.map(role => {
                    const access = selectedPage.roles[role] || { read: false, edit: false };
                    return (
                      <tr key={role} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 500, textTransform: 'capitalize' }}>
                          {role.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={access.read}
                            onChange={() => handleRoleToggle(role, 'read')}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={access.edit}
                            onChange={() => handleRoleToggle(role, 'edit')}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn" onClick={() => setSelectedPage(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveModalSettings} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                Save Settings
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
