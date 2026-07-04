import React, { useState, useMemo } from 'react';
import { Search, Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Trash2, Plus, Upload, X, Download } from 'lucide-react';
import { useAgeingData, type AgeingRow } from '../../hooks/useAgeingData';
import { useAuth } from '../../contexts/AuthContext';
import AgeingItemModal from '../../components/ageing/AgeingItemModal';
import { collection, writeBatch, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import * as XLSX from 'xlsx';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

type SortKey = keyof AgeingRow | '';
type SortDir = 'asc' | 'desc' | 'none';

const COLUMNS: Array<{ key: keyof AgeingRow; label: string; align?: 'right' }> = [
  { key: 'branch', label: 'Branch' },
  { key: 'category', label: 'Category' },
  { key: 'item_code', label: 'Item Code' },
  { key: 'item_description', label: 'Description' },
  { key: 'ads', label: 'ADS', align: 'right' },
  { key: 'production_date', label: 'Prod. Date' },
  { key: 'expiry_date', label: 'Expiry Date' },
  { key: 'qty', label: 'Qty', align: 'right' },
  { key: 'uom', label: 'UOM' },
  { key: 'days_to_go', label: 'Days to Go', align: 'right' },
  { key: 'idl', label: 'IDL', align: 'right' },
  { key: 'timestamp', label: 'Timestamp' }
];

const PAGE_SIZE = 50;

const Ageing: React.FC = () => {
  const { role } = useAuth();
  const { loading, rows, reportDate, refresh } = useAgeingData();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDir, setSortDir] = useState<SortDir>('none');
  const [page, setPage] = useState(1);

  // Local Edits State
  const [localRows, setLocalRows] = useState<AgeingRow[]>([]);
  const [hasEdits, setHasEdits] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{row: AgeingRow, originalIndex: number} | null>(null);

  React.useEffect(() => {
    if (!hasEdits) {
      setLocalRows(rows);
    }
  }, [rows, hasEdits]);

  const branches = useMemo(() =>
    Array.from(new Set(localRows.map(r => r.branch).filter(Boolean))).sort(), [localRows]);
  const categories = useMemo(() =>
    Array.from(new Set(localRows.map(r => r.category).filter(Boolean))).sort(), [localRows]);
  const itemCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    localRows.forEach(r => {
      if (r.item_code && r.category) {
        map[r.item_code] = r.category;
      }
    });
    return map;
  }, [localRows]);

  const filtered = useMemo(() => {
    // Map with original index so we can accurately edit/delete
    let result = localRows.map((row, index) => ({ row, index })).filter(({ row: r }) => {
      const matchSearch =
        r.item_code?.toLowerCase().includes(search.toLowerCase()) ||
        r.item_description?.toLowerCase().includes(search.toLowerCase());
      const matchBranch = branchFilter === 'all' || r.branch === branchFilter;
      const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
      return matchSearch && matchBranch && matchCategory;
    });

    if (sortKey && sortDir !== 'none') {
      result = [...result].sort((aObj, bObj) => {
        const av = aObj.row[sortKey as keyof AgeingRow];
        const bv = bObj.row[sortKey as keyof AgeingRow];
        let cmp = 0;

        if (sortKey === 'days_to_go') {
          const aVal = av === 'Expired' ? -1 : Number(av);
          const bVal = bv === 'Expired' ? -1 : Number(bv);
          cmp = aVal - bVal;
        } else if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv;
        } else {
          cmp = String(av || '').localeCompare(String(bv || ''));
        }
        
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [localRows, search, branchFilter, categoryFilter, sortKey, sortDir]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  const handleSort = (key: keyof AgeingRow) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') { setSortKey(''); setSortDir('none'); }
  };

  const SortIcon: React.FC<{ col: keyof AgeingRow }> = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} style={{ marginLeft: '4px', opacity: 0.3 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: '4px', color: 'var(--accent-primary)' }} />
      : <ChevronDown size={12} style={{ marginLeft: '4px', color: 'var(--accent-primary)' }} />;
  };

  const SlicerRow: React.FC<{ options: string[], selected: string, onSelect: (val: string) => void, label: string }> = ({ options, selected, onSelect, label }) => (
    <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', width: '100%', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', marginRight: '4px' }}>
        {label}:
      </span>
      {selected !== 'all' && (
        <>
          <button
            onClick={() => onSelect('all')}
            style={{
              padding: '6px 14px', borderRadius: '16px', border: 'none', whiteSpace: 'nowrap',
              backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)',
              fontSize: '12px', cursor: 'pointer', flexShrink: 0
            }}
          >
            Clear
          </button>
          <div style={{ width: '1px', backgroundColor: 'var(--border)', margin: '0 4px', flexShrink: 0, height: '24px' }} />
        </>
      )}
      {options.map(o => (
        <button
          key={o}
          onClick={() => onSelect(o)}
          style={{
            padding: '6px 14px', borderRadius: '16px', border: '1px solid', whiteSpace: 'nowrap',
            borderColor: selected === o ? 'var(--accent-primary)' : 'var(--border)',
            backgroundColor: selected === o ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
            color: selected === o ? '#fff' : 'var(--text-muted)',
            fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );

  const handleDelete = (index: number) => {
    const newRows = [...localRows];
    newRows.splice(index, 1);
    setLocalRows(newRows);
    setHasEdits(true);
  };

  const handleSaveModal = (item: AgeingRow) => {
    const newRows = [...localRows];
    // Use the current date if the item is edited
    const editedItem = { ...item, timestamp: new Date().toISOString().split('T')[0], source: 'Manual', _is_new_or_edited: true };
    if (editingItem) {
      newRows[editingItem.originalIndex] = editedItem;
    } else {
      newRows.unshift(editedItem); // Add to top
    }
    setLocalRows(newRows);
    setHasEdits(true);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleUploadEdits = async () => {
    if (!hasEdits) return;
    setUploading(true);
    try {
      const snapshot = await getDocs(collection(db, 'ageing_data'));
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();

      const CHUNK_SIZE = 2000;
      for (let i = 0; i < localRows.length; i += CHUNK_SIZE) {
        // Strip out temporary UI flags before saving to database
        const chunk = localRows.slice(i, i + CHUNK_SIZE).map(({ _is_new_or_edited, ...rest }) => rest);
        const chunkIndex = Math.floor(i / CHUNK_SIZE);
        await setDoc(doc(collection(db, 'ageing_data'), `chunk_${chunkIndex}`), { rows: JSON.stringify(chunk) });
      }
      await setDoc(doc(db, 'settings', 'global'), { lastAgeingUpload: Date.now() }, { merge: true });
      await refresh();
      setHasEdits(false);
      alert('Edits uploaded successfully.');
    } catch (err) {
      console.error('Error uploading ageing edits:', err);
      alert('Failed to upload edits.');
    } finally {
      setUploading(false);
    }
  };

  const handleExport = () => {
    const exportData = localRows.map(r => ({
      branch: r.branch,
      category: r.category,
      item_code: r.item_code,
      item_description: r.item_description,
      ads: r.ads,
      production_date: r.production_date,
      expiry_date: r.expiry_date,
      qty: r.qty,
      uom: r.uom,
      days_to_go: r.days_to_go,
      idl: r.idl,
      timestamp: r.timestamp || '-',
      source: r.source || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ageing Report");
    XLSX.writeFile(wb, `Ageing_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const canEdit = role === 'admin' || role === 'warehouse_supervisor';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Ageing Report</h2>
          {reportDate && (
            <p style={{ marginTop: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Report Date:{' '}
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{reportDate}</span>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '6px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Showing <strong style={{ color: 'var(--text-main)' }}>{filtered.length.toLocaleString()}</strong> rows</span>
            <button onClick={handleExport} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Export to Excel">
              <Download size={14} />
            </button>
          </div>
          {hasEdits && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setLocalRows(rows); setHasEdits(false); }} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid var(--accent-danger)' }}>
                <X size={14} style={{ marginRight: '4px' }} /> Revert Edits
              </button>
              <button onClick={handleUploadEdits} disabled={uploading} className="btn" style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--accent-primary)', color: 'white', border: 'none' }}>
                {uploading ? <Loader2 size={14} className="animate-spin" style={{ marginRight: '4px' }} /> : <Upload size={14} style={{ marginRight: '4px' }} />}
                Upload Edits
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '250px', maxWidth: '400px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by item code or description..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', boxSizing: 'border-box',
                background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
                borderRadius: '8px', color: 'white', fontSize: '14px'
              }}
            />
          </div>
          {canEdit && (
            <button 
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="btn btn-primary" 
              style={{ padding: '10px 16px' }}
            >
              <Plus size={16} style={{ marginRight: '6px' }} /> Add Item
            </button>
          )}
        </div>
        
        {branches.length > 0 && (
          <SlicerRow options={branches} selected={branchFilter} onSelect={v => { setBranchFilter(v); setPage(1); }} label="Branches" />
        )}
        {categories.length > 0 && (
          <SlicerRow options={categories} selected={categoryFilter} onSelect={v => { setCategoryFilter(v); setPage(1); }} label="Categories" />
        )}
      </div>

      {/* Table */}
      {loading ? <PageSkeleton /> : (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.3)' }}>
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '12px 14px',
                        textAlign: col.align || 'left',
                        color: sortKey === col.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                        fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                        whiteSpace: 'nowrap', position: 'sticky', top: 0,
                        background: 'rgba(15, 23, 42, 0.95)'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {col.label}<SortIcon col={col.key} />
                      </span>
                    </th>
                  ))}
                  {canEdit && <th style={{ padding: '12px 14px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paged.map(({row, index}) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      backgroundColor: row._is_new_or_edited ? 'rgba(59, 130, 246, 0.1)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      transition: 'background 0.15s',
                      boxShadow: row._is_new_or_edited ? 'inset 4px 0 0 var(--accent-primary)' : 'none'
                    }}
                    title={row._is_new_or_edited ? "Pending Upload" : ""}
                  >
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{row.branch}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{row.category}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px' }}>{row.item_code}</td>
                    <td style={{ padding: '10px 14px', maxWidth: '220px' }}>{row.item_description}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{row.ads.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{row.production_date}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: row.days_to_go === 'Expired' ? 'var(--accent-danger)' : (row.days_to_go as number) <= 30 ? 'var(--accent-danger)' : (row.days_to_go as number) <= 60 ? '#fb923c' : 'inherit' }}>
                      {row.expiry_date}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{row.qty.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px' }}>{row.uom}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: row.days_to_go === 'Expired' ? 'var(--accent-danger)' : (row.days_to_go as number) <= 30 ? '#fb923c' : 'var(--accent-success)' }}>
                      {row.days_to_go}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {typeof row.idl === 'number' ? row.idl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : !isNaN(parseFloat(String(row.idl))) ? parseFloat(String(row.idl)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : row.idl}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{row.timestamp || '-'}</span>
                        {row.source && (
                          <span style={{ 
                            fontSize: '9px', 
                            padding: '2px 6px', 
                            borderRadius: '12px', 
                            background: row.source === 'System' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: row.source === 'System' ? '#10b981' : '#f59e0b',
                            textTransform: 'uppercase',
                            fontWeight: 600
                          }}>
                            {row.source}
                          </span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setEditingItem({row, originalIndex: index}); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(index)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', padding: '4px', marginLeft: '4px' }} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {paged.length === 0 && (
                  <tr><td colSpan={canEdit ? 13 : 12} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No data found. Upload an Ageing Report in the Data page.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {paged.length < filtered.length && (
            <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setPage(p => p + 1)}
                className="btn"
                style={{ padding: '8px 24px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}
              >
                Load More ({filtered.length - paged.length} remaining)
              </button>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <AgeingItemModal
          initialData={editingItem?.row}
          existingBranches={branches}
          existingCategories={categories}
          itemCategoryMap={itemCategoryMap}
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
};

export default Ageing;
