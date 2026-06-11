import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePricelist } from '../../hooks/usePricelist';
import { useProductAds } from '../../hooks/useProductAds';
import { useItemCategories } from '../../hooks/useItemCategories';
import type { AgeingRow } from '../../hooks/useAgeingData';

interface AgeingItemModalProps {
  onClose: () => void;
  onSave: (item: AgeingRow) => void;
  initialData?: AgeingRow | null;
  existingBranches?: string[];
  existingCategories?: string[];
  itemCategoryMap?: Record<string, string>;
}

const AgeingItemModal: React.FC<AgeingItemModalProps> = ({ onClose, onSave, initialData, existingBranches = [], existingCategories = [], itemCategoryMap = {} }) => {
  const { role, branch: userBranch } = useAuth();
  const { priceMap } = usePricelist();
  const { adsMap } = useProductAds();
  const { categoryMap, descriptionMap } = useItemCategories();

  const [formData, setFormData] = useState<Partial<AgeingRow>>(initialData || {
    branch: (role === 'warehouse_supervisor' && userBranch) ? userBranch : '',
    category: '',
    item_code: '',
    item_description: '',
    ads: 0,
    production_date: '',
    expiry_date: '',
    qty: 0,
    uom: 'CASE',
    days_to_go: 0,
    idl: 0
  });

  const [caseQty, setCaseQty] = useState(0);
  const [subcaseQty, setSubcaseQty] = useState(0);
  const [pieceQty, setPieceQty] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const filteredBranches = existingBranches.filter(b => b.toLowerCase().includes(formData.branch?.toLowerCase() || ''));

  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const knownCat = formData.item_code ? (itemCategoryMap[formData.item_code] || categoryMap[formData.item_code]) : null;
  const allKnownCategories = Array.from(new Set([...existingCategories, ...Object.values(categoryMap)])).filter(Boolean).sort();
  const filteredCats = allKnownCategories.filter(c => c.toLowerCase().includes(formData.category?.toLowerCase() || ''));

  const currentItemPrices = formData.item_code ? priceMap[formData.item_code] : null;
  const isCaseEnabled = !currentItemPrices || currentItemPrices.case_price > 0;
  const isSubcaseEnabled = !!(currentItemPrices && currentItemPrices.subcase_price > 0);
  const isPieceEnabled = !!(currentItemPrices && currentItemPrices.piece_price > 0);

  // Initialize quantities based on initialData if editing
  useEffect(() => {
    if (initialData && initialData.qty) {
      if (initialData.uom === 'CASE') setCaseQty(initialData.qty);
      else if (initialData.uom === 'SUBCASE') setSubcaseQty(initialData.qty);
      else if (initialData.uom === 'PIECE') setPieceQty(initialData.qty);
    }
  }, [initialData]);

  // Autocomplete logic
  const searchResults = Object.entries(descriptionMap).filter(([code, desc]) => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return code.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleSelectItem = (code: string) => {
    const desc = descriptionMap[code] || priceMap[code]?.product_description || '';
    const ads = adsMap[code]?.ads || 0;

    setFormData(prev => ({
      ...prev,
      item_code: code,
      item_description: desc,
      ads: ads,
      category: itemCategoryMap[code] || categoryMap[code] || prev.category
    }));
    setSearchQuery(desc);
    setShowDropdown(false);
  };

  // Recalculate QTY, UOM, and IDL
  useEffect(() => {
    if (!formData.item_code) return;

    let totalCases = 0;
    const itemPrices = priceMap[formData.item_code];

    if (itemPrices) {
      const casePrice = itemPrices.case_price || 1;
      const subcasePrice = itemPrices.subcase_price || 0;
      const piecePrice = itemPrices.piece_price || 0;

      const totalAmount =
        (caseQty * casePrice) +
        (subcaseQty * subcasePrice) +
        (pieceQty * piecePrice);

      totalCases = totalAmount / casePrice;
    } else {
      // Fallback if no price: guess based on quantities
      totalCases = caseQty + (subcaseQty * 0.5) + (pieceQty * 0.05);
    }

    const productAds = adsMap[formData.item_code];
    let dynamicAds = 0;

    if (productAds) {
      if (formData.branch && productAds.branchAds && productAds.branchAds[formData.branch.toUpperCase()]) {
        dynamicAds = productAds.branchAds[formData.branch.toUpperCase()];
      } else if (productAds.ads > 0) {
        dynamicAds = productAds.ads;
      }
    }

    if (!dynamicAds && Number(formData.ads)) {
      dynamicAds = Number(formData.ads);
    }

    const idl = dynamicAds > 0 ? (totalCases / dynamicAds) : 0;

    let finalQty = 0;
    let finalUom = 'CASE';

    if (caseQty > 0) { finalQty = caseQty; finalUom = 'CASE'; }
    else if (subcaseQty > 0) { finalQty = subcaseQty; finalUom = 'SUBCASE'; }
    else if (pieceQty > 0) { finalQty = pieceQty; finalUom = 'PIECE'; }

    setFormData(prev => ({
      ...prev,
      qty: finalQty,
      uom: finalUom,
      idl: idl,
      ads: dynamicAds
    }));
  }, [caseQty, subcaseQty, pieceQty, formData.item_code, formData.ads, formData.branch, priceMap, adsMap]);

  // Recalculate days_to_go
  useEffect(() => {
    if (formData.expiry_date) {
      const expiry = new Date(formData.expiry_date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      expiry.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setFormData(prev => ({ ...prev, days_to_go: diffDays <= 0 ? 'Expired' : diffDays }));
    }
  }, [formData.expiry_date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as AgeingRow);
  };

  const adjustQty = (setter: React.Dispatch<React.SetStateAction<number>>, amount: number) => {
    setter(prev => Math.max(0, prev + amount));
  };

  return createPortal(
    <div className="animate-fade-in-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <h2 style={{ marginBottom: '24px', color: 'var(--accent-primary)' }}>
          {initialData ? 'Edit Ageing Item' : 'Add Ageing Item'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Branch</label>
              <div
                className="input-field"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: role === 'warehouse_supervisor' ? 'default' : 'pointer',
                  opacity: role === 'warehouse_supervisor' ? 0.7 : 1
                }}
                onClick={() => {
                  if (role !== 'warehouse_supervisor') {
                    setShowBranchDropdown(!showBranchDropdown);
                    setShowCatDropdown(false);
                  }
                }}
              >
                <input
                  type="text"
                  value={formData.branch}
                  onChange={e => {
                    if (role !== 'warehouse_supervisor') {
                      setFormData({ ...formData, branch: e.target.value.toUpperCase() });
                      setShowBranchDropdown(true);
                    }
                  }}
                  onFocus={() => {
                    if (role !== 'warehouse_supervisor') {
                      setShowBranchDropdown(true);
                      setShowCatDropdown(false);
                    }
                  }}
                  readOnly={role === 'warehouse_supervisor'}
                  placeholder="Enter Branch (e.g. KEA)"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', width: '100%', textTransform: 'uppercase' }}
                />
                {role !== 'warehouse_supervisor' && <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
              {showBranchDropdown && filteredBranches.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredBranches.map(b => (
                    <div
                      key={b}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, branch: b }));
                        setShowBranchDropdown(false);
                      }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{b}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Category</label>
              {knownCat ? (
                <input
                  type="text"
                  className="input-field"
                  value={formData.category || ''}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.category || ''}
                    onChange={e => {
                      setFormData({ ...formData, category: e.target.value });
                      setShowCatDropdown(true);
                    }}
                    onFocus={() => { setShowCatDropdown(true); setShowBranchDropdown(false); }}
                    onBlur={() => setTimeout(() => setShowCatDropdown(false), 200)}
                    placeholder="Select or type category..."
                    required
                  />
                  <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                  {showCatDropdown && filteredCats.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredCats.map(c => (
                        <div
                          key={c}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, category: c }));
                            setShowCatDropdown(false);
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{c}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Search Item</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '36px' }}
                placeholder="Search Item Code or Description..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => { setShowDropdown(true); setShowBranchDropdown(false); setShowCatDropdown(false); }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
            </div>

            {showDropdown && searchQuery && searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 50, marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {searchResults.map(([code, desc]) => (
                  <div
                    key={code}
                    onClick={() => handleSelectItem(code)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{code}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Production Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.production_date || ''}
                onChange={e => setFormData({ ...formData, production_date: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expiry Date</label>
              <input
                type="date"
                className="input-field"
                value={formData.expiry_date || ''}
                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
            {/* Case */}
            <div style={{ opacity: isCaseEnabled ? 1 : 0.5, pointerEvents: isCaseEnabled ? 'auto' : 'none' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'center' }}>Case</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" onClick={() => adjustQty(setCaseQty, -1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isCaseEnabled}>-</button>
                <input type="number" className="input-field" value={caseQty} onChange={e => setCaseQty(Number(e.target.value))} style={{ textAlign: 'center', margin: '0 4px', padding: '8px' }} disabled={!isCaseEnabled} />
                <button type="button" onClick={() => adjustQty(setCaseQty, 1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isCaseEnabled}>+</button>
              </div>
            </div>
            {/* Subcase */}
            <div style={{ opacity: isSubcaseEnabled ? 1 : 0.5, pointerEvents: isSubcaseEnabled ? 'auto' : 'none' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'center' }}>Subcase</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" onClick={() => adjustQty(setSubcaseQty, -1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isSubcaseEnabled}>-</button>
                <input type="number" className="input-field" value={subcaseQty} onChange={e => setSubcaseQty(Number(e.target.value))} style={{ textAlign: 'center', margin: '0 4px', padding: '8px' }} disabled={!isSubcaseEnabled} />
                <button type="button" onClick={() => adjustQty(setSubcaseQty, 1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isSubcaseEnabled}>+</button>
              </div>
            </div>
            {/* Piece */}
            <div style={{ opacity: isPieceEnabled ? 1 : 0.5, pointerEvents: isPieceEnabled ? 'auto' : 'none' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'center' }}>Piece</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button type="button" onClick={() => adjustQty(setPieceQty, -1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isPieceEnabled}>-</button>
                <input type="number" className="input-field" value={pieceQty} onChange={e => setPieceQty(Number(e.target.value))} style={{ textAlign: 'center', margin: '0 4px', padding: '8px' }} disabled={!isPieceEnabled} />
                <button type="button" onClick={() => adjustQty(setPieceQty, 1)} className="btn" style={{ padding: '8px', background: 'var(--bg-dark)' }} disabled={!isPieceEnabled}>+</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginTop: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Days to Go</label>
              <div style={{ fontSize: '16px', fontWeight: 600, color: formData.days_to_go === 'Expired' || Number(formData.days_to_go) <= 30 ? 'var(--accent-danger)' : 'var(--text-main)' }}>
                {formData.days_to_go}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Matched ADS</label>
              <div style={{ fontSize: '16px', fontWeight: 600, color: formData.ads && formData.ads > 0 ? 'var(--text-main)' : 'var(--accent-danger)' }}>
                {Number(formData.ads || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>IDL Calculation</label>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {Number(formData.idl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>days</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Item</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AgeingItemModal;
