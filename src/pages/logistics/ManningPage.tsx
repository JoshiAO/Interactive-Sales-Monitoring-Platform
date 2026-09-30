import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Truck, Plus, Trash2, Save, Search, User, Users, Phone, Camera, Check, ChevronDown, Edit2 } from 'lucide-react';
import { collection, onSnapshot, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Modal } from '../../components/ui/Modal';
import type { LogisticsManning, LogisticsDriver, LogisticsHelper } from '../../types/logistics';
import { saveDraft } from '../../utils/indexedDB';
import { compressImageFile, compressImageDataUrl } from '../../utils/imageCompressor';

type UserDeliveryTeam = {
  id: string;
  name: string;
  plateNumber: string;
  vehicleType: string;
};

const EMPTY_MANNING: Omit<LogisticsManning, 'id' | 'createdAt' | 'updatedAt'> = {
  plateNumber: '',
  driverName: '',
  helpers: [],
  vehicleType: 'Elf',
};

const ManningPage: React.FC = () => {
  const { role } = useAuth();
  const { canEditPage } = useUI();
  const [manningRecords, setManningRecords] = useState<LogisticsManning[]>([]);
  const [deliveryTeamUsers, setDeliveryTeamUsers] = useState<UserDeliveryTeam[]>([]);
  const [drivers, setDrivers] = useState<LogisticsDriver[]>([]);
  const [helpers, setHelpers] = useState<LogisticsHelper[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingRecord, setEditingRecord] = useState<LogisticsManning | null>(null);
  const [formData, setFormData] = useState(EMPTY_MANNING);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Plate Selector Modal State
  const [isPlateModalOpen, setIsPlateModalOpen] = useState(false);
  const [plateSearchQuery, setPlateSearchQuery] = useState('');

  // Personnel Add Modal State
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false);
  const [isAddHelperModalOpen, setIsAddHelperModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonPhoto, setNewPersonPhoto] = useState('');
  const [savingPersonnel, setSavingPersonnel] = useState(false);

  // Personnel Edit Modal State
  const [editingPerson, setEditingPerson] = useState<{
    type: 'driver' | 'helper';
    id: string;
    name: string;
    phone: string;
    photoURL: string;
  } | null>(null);
  const [editPersonName, setEditPersonName] = useState('');
  const [editPersonPhone, setEditPersonPhone] = useState('');
  const [editPersonPhoto, setEditPersonPhoto] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingPerson, setIsDeletingPerson] = useState(false);

  const driverFileInputRef = useRef<HTMLInputElement>(null);
  const helperFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = canEditPage('logistics_manning', role!);

  // Real-time listeners
  useEffect(() => {
    const unsubs = [
      // Listen to Manning records
      onSnapshot(collection(db, 'logistics_manning'), (snap) => {
        const records: LogisticsManning[] = [];
        snap.forEach((d) => {
          records.push({ id: d.id, ...d.data() } as LogisticsManning);
        });
        records.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber));
        setManningRecords(records);
        setLoading(false);
      }),
      // Listen to registered Delivery Team users
      onSnapshot(collection(db, 'users'), (snap) => {
        const dtUsers: UserDeliveryTeam[] = [];
        snap.forEach((d) => {
          const u = d.data();
          if (u.role === 'delivery_team') {
            dtUsers.push({
              id: d.id,
              name: u.name || '',
              plateNumber: u.plateNumber || u.name || '',
              vehicleType: u.vehicleType || 'Elf',
            });
          }
        });
        setDeliveryTeamUsers(dtUsers);
      }),
      // Listen to Drivers
      onSnapshot(collection(db, 'logistics_drivers'), (snap) => {
        const drvs: LogisticsDriver[] = [];
        snap.forEach((d) => {
          drvs.push({ id: d.id, ...d.data() } as LogisticsDriver);
        });
        drvs.sort((a, b) => a.name.localeCompare(b.name));
        setDrivers(drvs);
      }),
      // Listen to Helpers
      onSnapshot(collection(db, 'logistics_helpers'), (snap) => {
        const hlps: LogisticsHelper[] = [];
        snap.forEach((d) => {
          hlps.push({ id: d.id, ...d.data() } as LogisticsHelper);
        });
        hlps.sort((a, b) => a.name.localeCompare(b.name));
        setHelpers(hlps);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return manningRecords;
    const q = searchQuery.toLowerCase();
    return manningRecords.filter(
      (r) =>
        r.plateNumber.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        (r.helpers && r.helpers.some((h) => h.toLowerCase().includes(q))) ||
        r.vehicleType.toLowerCase().includes(q)
    );
  }, [manningRecords, searchQuery]);

  const filteredDeliveryTeamUsers = useMemo(() => {
    if (!plateSearchQuery.trim()) return deliveryTeamUsers;
    const q = plateSearchQuery.toLowerCase();
    return deliveryTeamUsers.filter(
      (u) =>
        u.plateNumber.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.vehicleType.toLowerCase().includes(q)
    );
  }, [deliveryTeamUsers, plateSearchQuery]);

  const handleCreateNew = () => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_MANNING, helpers: [] });
  };

  const handleSelectForEdit = (record: LogisticsManning) => {
    setEditingRecord(record);
    setFormData({
      plateNumber: record.plateNumber,
      driverName: record.driverName,
      helpers: record.helpers ? [...record.helpers] : [],
      vehicleType: record.vehicleType,
    });
  };

  // Driver Selection (1 Driver only)
  const handleToggleDriver = (driverName: string) => {
    setFormData((prev) => ({
      ...prev,
      driverName: prev.driverName.toLowerCase() === driverName.toLowerCase() ? '' : driverName,
    }));
  };

  // Helper Selection (Multiple acceptable)
  const handleToggleHelper = (helperName: string) => {
    setFormData((prev) => {
      const exists = prev.helpers.some((h) => h.toLowerCase() === helperName.toLowerCase());
      if (exists) {
        return {
          ...prev,
          helpers: prev.helpers.filter((h) => h.toLowerCase() !== helperName.toLowerCase()),
        };
      } else {
        return {
          ...prev,
          helpers: [...prev.helpers, helperName],
        };
      }
    });
  };

  // Save Driver Modal
  const handleSaveDriver = async () => {
    if (!newPersonName.trim()) return;
    setSavingPersonnel(true);
    try {
      const compressedPhoto = newPersonPhoto ? await compressImageDataUrl(newPersonPhoto, 300, 300, 0.75) : '';
      const id = `drv_${Date.now()}`;
      await setDoc(doc(db, 'logistics_drivers', id), {
        name: newPersonName.trim(),
        phone: newPersonPhone.trim(),
        photoURL: compressedPhoto,
        createdAt: new Date().toISOString(),
      });
      // Automatically select newly created driver
      setFormData((prev) => ({ ...prev, driverName: newPersonName.trim() }));
      setIsAddDriverModalOpen(false);
      setNewPersonName('');
      setNewPersonPhone('');
      setNewPersonPhoto('');
    } catch (err: any) {
      alert('Failed to add driver: ' + err.message);
    } finally {
      setSavingPersonnel(false);
    }
  };

  // Save Helper Modal
  const handleSaveHelper = async () => {
    if (!newPersonName.trim()) return;
    setSavingPersonnel(true);
    try {
      const compressedPhoto = newPersonPhoto ? await compressImageDataUrl(newPersonPhoto, 300, 300, 0.75) : '';
      const id = `hlp_${Date.now()}`;
      await setDoc(doc(db, 'logistics_helpers', id), {
        name: newPersonName.trim(),
        phone: newPersonPhone.trim(),
        photoURL: compressedPhoto,
        createdAt: new Date().toISOString(),
      });
      // Automatically add newly created helper
      setFormData((prev) => ({
        ...prev,
        helpers: [...prev.helpers, newPersonName.trim()],
      }));
      setIsAddHelperModalOpen(false);
      setNewPersonName('');
      setNewPersonPhone('');
      setNewPersonPhoto('');
    } catch (err: any) {
      alert('Failed to add helper: ' + err.message);
    } finally {
      setSavingPersonnel(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        // Compress image client-side to max 300x300 JPEG (~15-25KB)
        const compressedDataUrl = await compressImageFile(file, 300, 300, 0.75);
        setNewPersonPhoto(compressedDataUrl);
      } catch (err) {
        console.error('Failed to compress image:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          setNewPersonPhoto(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleOpenEditPerson = (type: 'driver' | 'helper', person: LogisticsDriver | LogisticsHelper, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPerson({
      type,
      id: person.id,
      name: person.name,
      phone: person.phone || '',
      photoURL: person.photoURL || '',
    });
    setEditPersonName(person.name);
    setEditPersonPhone(person.phone || '');
    setEditPersonPhoto(person.photoURL || '');
  };

  const handleSavePersonEdit = async () => {
    if (!editingPerson || !editPersonName.trim()) return;
    setIsSavingEdit(true);
    try {
      const collectionName = editingPerson.type === 'driver' ? 'logistics_drivers' : 'logistics_helpers';
      const compressedPhoto = editPersonPhoto ? await compressImageDataUrl(editPersonPhoto, 300, 300, 0.75) : '';

      await setDoc(
        doc(db, collectionName, editingPerson.id),
        {
          name: editPersonName.trim(),
          phone: editPersonPhone.trim(),
          photoURL: compressedPhoto,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // If name changed, update current form selection
      if (editingPerson.type === 'driver') {
        if (formData.driverName.toLowerCase() === editingPerson.name.toLowerCase()) {
          setFormData((prev) => ({ ...prev, driverName: editPersonName.trim() }));
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          helpers: prev.helpers.map((h) => (h.toLowerCase() === editingPerson.name.toLowerCase() ? editPersonName.trim() : h)),
        }));
      }

      setEditingPerson(null);
    } catch (err: any) {
      alert('Failed to update details: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePerson = async () => {
    if (!editingPerson) return;
    if (!confirm(`Are you sure you want to delete ${editingPerson.type === 'driver' ? 'Driver' : 'Helper'} "${editingPerson.name}"? This will permanently delete the record and picture.`)) return;

    setIsDeletingPerson(true);
    try {
      const collectionName = editingPerson.type === 'driver' ? 'logistics_drivers' : 'logistics_helpers';
      await deleteDoc(doc(db, collectionName, editingPerson.id));

      // Remove from current form selection if selected
      if (editingPerson.type === 'driver') {
        if (formData.driverName.toLowerCase() === editingPerson.name.toLowerCase()) {
          setFormData((prev) => ({ ...prev, driverName: '' }));
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          helpers: prev.helpers.filter((h) => h.toLowerCase() !== editingPerson.name.toLowerCase()),
        }));
      }

      setEditingPerson(null);
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setIsDeletingPerson(false);
    }
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressedDataUrl = await compressImageFile(file, 300, 300, 0.75);
        setEditPersonPhoto(compressedDataUrl);
      } catch (err) {
        console.error('Failed to compress image:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          setEditPersonPhoto(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSaveToDraft = async () => {
    if (!formData.plateNumber.trim() || !formData.driverName.trim()) return;
    setSaving(true);
    try {
      const cleanHelpers = formData.helpers.filter((h) => h.trim() !== '');
      const docId = editingRecord?.id || formData.plateNumber.replace(/[^a-zA-Z0-9_-]/g, '_');

      const payload = {
        id: docId,
        plateNumber: formData.plateNumber.trim(),
        driverName: formData.driverName.trim(),
        helpers: cleanHelpers,
        vehicleType: formData.vehicleType,
        createdAt: editingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveDraft('manning', payload);
      alert('Saved to local drafts! Sync via the pending cloud button.');
      handleCreateNew();
    } catch (err: any) {
      console.error('Error saving manning record to draft:', err);
      alert('Failed to save draft: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_manning', id));
      setDeleteConfirm(null);
      if (editingRecord?.id === id) {
        handleCreateNew();
      }
    } catch (err: any) {
      console.error('Error deleting manning record:', err);
      alert('Failed to delete: ' + err.message);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'Tractor': return '🚛';
      case '10WH': return '🚚';
      case 'Forward': return '🚚';
      case '6WH': return '🚐';
      case 'Elf': return '🚐';
      default: return '🚗';
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={24} style={{ color: 'var(--accent-primary)' }} />
            Logistics Manning
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage vehicle teams, drivers, and helpers
          </p>
        </div>
      </div>

      {/* 60/40 Layout Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: 60% Form */}
        <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', borderRadius: '16px', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>{editingRecord ? (canEdit ? 'Edit Delivery Team' : 'View Delivery Team') : 'Create New Delivery Team'}</h3>
            {editingRecord && canEdit && (
              <button onClick={handleCreateNew} className="btn" style={{ fontSize: '13px' }}>
                <Plus size={14} /> New Entry
              </button>
            )}
          </div>

          {/* ─── PLATE NUMBER SELECTOR & UNEDITABLE VEHICLE TYPE ─── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Plate Number Selector Button */}
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Plate Number (Delivery Team) *
              </label>
              <button
                type="button"
                onClick={() => { setPlateSearchQuery(''); setIsPlateModalOpen(true); }}
                disabled={!!editingRecord}
                className="btn"
                id="manning-plate-selector-btn"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: formData.plateNumber ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: editingRecord || !canEdit ? 'not-allowed' : 'pointer',
                  opacity: editingRecord || !canEdit ? 0.7 : 1,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Truck size={16} />
                  {formData.plateNumber || 'Select Delivery Team / Plate...'}
                </span>
                {!editingRecord && canEdit && <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </button>
            </div>

            {/* Uneditable Vehicle Type (Inherited from Delivery Team User) */}
            <div>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Vehicle Type (Inherited)
              </label>
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  userSelect: 'none',
                  cursor: 'not-allowed',
                  opacity: 0.85,
                }}
              >
                <span>{getVehicleIcon(formData.vehicleType)}</span>
                <span>{formData.vehicleType || 'Elf'}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Auto)</span>
              </div>
            </div>
          </div>

          {/* ─── ROW 1: DRIVER CARDS (Horizontally Scrolled, 1 Driver Only) ─── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={16} style={{ color: 'var(--accent-primary)' }} />
                  Delivery Driver *
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Selected: <strong style={{ color: formData.driverName ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>{formData.driverName || 'None'}</strong> (1 driver limit)
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={() => { setNewPersonName(''); setNewPersonPhone(''); setNewPersonPhoto(''); setIsAddDriverModalOpen(true); }}
                  className="btn"
                  style={{ fontSize: '12px', padding: '5px 12px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-primary)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                >
                  <Plus size={14} /> Add Driver
                </button>
              )}
            </div>

            {/* Horizontally Scrolled Driver Cards Container */}
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '12px', minHeight: '110px', scrollbarWidth: 'thin' }}>
              {drivers.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                  No drivers registered yet. Click "+ Add Driver" to create driver profiles with pictures.
                </div>
              ) : (
                drivers.map((drv) => {
                  const isSelected = formData.driverName.toLowerCase() === drv.name.toLowerCase();
                  return (
                    <div
                      key={drv.id}
                      onClick={() => handleToggleDriver(drv.name)}
                      className={`glass-panel hover-bright ${isSelected ? 'active' : ''}`}
                      style={{
                        minWidth: '150px',
                        maxWidth: '170px',
                        padding: '12px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 0 16px rgba(59, 130, 246, 0.25)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Edit Button */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditPerson('driver', drv, e)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid var(--border)',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          zIndex: 5,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                        title="Edit Driver Profile"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}

                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--accent-primary)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} color="white" />
                        </div>
                      )}

                      {/* Driver Avatar Picture */}
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-dark)', border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {drv.photoURL ? (
                          <img src={drv.photoURL} alt={drv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-primary)' }}>
                            {drv.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? 'white' : 'var(--text-main)', lineHeight: '1.2' }}>
                          {drv.name}
                        </div>
                        {drv.phone && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                            <Phone size={10} /> {drv.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── ROW 2: HELPER CARDS (Horizontally Scrolled, Multiple Acceptable) ─── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} style={{ color: 'var(--accent-success)' }} />
                  List of Helpers
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Selected ({formData.helpers.length}): <strong style={{ color: 'var(--accent-success)' }}>{formData.helpers.length > 0 ? formData.helpers.join(', ') : 'None'}</strong> (Multiple acceptable)
                </span>
              </div>
              {canEdit && (
                <button
                  onClick={() => { setNewPersonName(''); setNewPersonPhone(''); setNewPersonPhoto(''); setIsAddHelperModalOpen(true); }}
                  className="btn"
                  style={{ fontSize: '12px', padding: '5px 12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                >
                  <Plus size={14} /> Add Helper
                </button>
              )}
            </div>

            {/* Horizontally Scrolled Helper Cards Container */}
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '12px', minHeight: '110px', scrollbarWidth: 'thin' }}>
              {helpers.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px 0' }}>
                  No helpers registered yet. Click "+ Add Helper" to create helper profiles with pictures.
                </div>
              ) : (
                helpers.map((hlp) => {
                  const isSelected = formData.helpers.some((h) => h.toLowerCase() === hlp.name.toLowerCase());
                  return (
                    <div
                      key={hlp.id}
                      onClick={() => handleToggleHelper(hlp.name)}
                      className={`glass-panel hover-bright ${isSelected ? 'active' : ''}`}
                      style={{
                        minWidth: '150px',
                        maxWidth: '170px',
                        padding: '12px',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: '8px',
                        flexShrink: 0,
                        border: isSelected ? '2px solid var(--accent-success)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        boxShadow: isSelected ? '0 0 16px rgba(16, 185, 129, 0.25)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Edit Button */}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditPerson('helper', hlp, e)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: '1px solid var(--border)',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          zIndex: 5,
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                        title="Edit Helper Profile"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--accent-success)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={12} color="white" />
                        </div>
                      )}

                      {/* Helper Avatar Picture */}
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-dark)', border: `2px solid ${isSelected ? 'var(--accent-success)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {hlp.photoURL ? (
                          <img src={hlp.photoURL} alt={hlp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-success)' }}>
                            {hlp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? 'white' : 'var(--text-main)', lineHeight: '1.2' }}>
                          {hlp.name}
                        </div>
                        {hlp.phone && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                            <Phone size={10} /> {hlp.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            {canEdit && (
              <button
                onClick={handleSaveToDraft}
                className="btn btn-primary"
                disabled={saving || !formData.plateNumber.trim() || !formData.driverName.trim()}
                id="save-manning-btn"
                style={{ padding: '12px 24px', fontSize: '14px' }}
              >
                {saving ? (
                  <><span className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '50%', display: 'inline-block' }} /> Saving...</>
                ) : (
                  <><Save size={18} /> {editingRecord ? 'Update & Save to Draft' : 'Save to Draft'}</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 40% Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              id="manning-search"
              type="text"
              placeholder="Search team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%', fontSize: '13px', padding: '8px 8px 8px 36px' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No records found</div>
            ) : (
              filteredRecords.map((record) => (
                <div
                  key={record.id}
                  className={`glass-panel ${editingRecord?.id === record.id ? 'active' : ''}`}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    position: 'relative',
                    border: editingRecord?.id === record.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  }}
                  onClick={() => handleSelectForEdit(record)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getVehicleIcon(record.vehicleType)} {record.plateNumber}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {record.vehicleType}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(record.id); }}
                      className="btn-icon"
                      style={{ width: '24px', height: '24px' }}
                    >
                      <Trash2 size={12} color="var(--accent-danger)" />
                    </button>
                  </div>
                  
                  <div style={{ marginTop: '10px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Driver:</span> <strong style={{ color: 'var(--text-main)' }}>{record.driverName}</strong>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Helpers:</span> 
                    {record.helpers && record.helpers.length > 0 ? (
                       <span style={{ color: 'var(--accent-success)', fontWeight: 500 }}>{record.helpers.join(', ')}</span>
                    ) : (
                       <span style={{ fontStyle: 'italic', opacity: 0.5 }}>None</span>
                    )}
                  </div>

                  {deleteConfirm === record.id && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)',
                      backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '14px',
                      zIndex: 5, animation: 'fadeIn 0.2s ease-out',
                    }}>
                      <p style={{ fontSize: '12px', textAlign: 'center', margin: 0 }}>Delete this team?</p>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="btn" style={{ fontSize: '11px', padding: '4px 10px' }}>Cancel</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }} className="btn" style={{ background: 'var(--accent-danger)', color: 'white', fontSize: '11px', padding: '4px 10px' }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ─── SELECT DELIVERY TEAM / PLATE MODAL ─── */}
      <Modal isOpen={isPlateModalOpen} onClose={() => setIsPlateModalOpen(false)} title="Select Delivery Team / Plate Number" maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search plate number, name..."
              value={plateSearchQuery}
              onChange={(e) => setPlateSearchQuery(e.target.value)}
              autoFocus
              style={{ paddingLeft: '36px', width: '100%' }}
            />
          </div>

          {/* List of Delivery Team Users */}
          <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {filteredDeliveryTeamUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No Delivery Team users found matching "{plateSearchQuery}".
                {plateSearchQuery.trim() && (
                  <div style={{ marginTop: '12px' }}>
                    <button
                      onClick={() => {
                        setFormData((p) => ({ ...p, plateNumber: plateSearchQuery.trim().toUpperCase() }));
                        setIsPlateModalOpen(false);
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      Use custom plate: "{plateSearchQuery.trim().toUpperCase()}"
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredDeliveryTeamUsers.map((u) => {
                const isSelected = formData.plateNumber === u.plateNumber.toUpperCase();
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        plateNumber: u.plateNumber.toUpperCase(),
                        vehicleType: (u.vehicleType as any) || 'Elf',
                      }));
                      setIsPlateModalOpen(false);
                    }}
                    className={`glass-panel hover-bright ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getVehicleIcon(u.vehicleType)} {u.plateNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Account: {u.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                        {u.vehicleType}
                      </span>
                      {isSelected && <Check size={16} color="var(--accent-primary)" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ─── ADD DRIVER MODAL ─── */}
      <Modal isOpen={isAddDriverModalOpen} onClose={() => setIsAddDriverModalOpen(false)} title="Add New Driver" maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '20px', alignItems: 'stretch' }}>
            {/* Left Column: 130x130 Photo Upload Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                onClick={() => driverFileInputRef.current?.click()}
                className="glass-panel hover-bright"
                style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '16px',
                  border: newPersonPhoto ? '2px solid var(--accent-primary)' : '2px dashed var(--border)',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: newPersonPhoto ? '#000' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.25 ease',
                  boxShadow: newPersonPhoto ? '0 0 20px rgba(59, 130, 246, 0.25)' : 'none',
                }}
              >
                {newPersonPhoto ? (
                  <>
                    <img src={newPersonPhoto} alt="Driver Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <Camera size={20} color="white" />
                      <span style={{ fontSize: '10px', color: 'white', fontWeight: 600 }}>Change</span>
                    </div>
                    {/* Clear Photo Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewPersonPhoto('');
                        if (driverFileInputRef.current) driverFileInputRef.current.value = '';
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(239, 68, 68, 0.85)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        cursor: 'pointer',
                        zIndex: 10,
                      }}
                      title="Remove Photo"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={24} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Upload Photo</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={driverFileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--accent-success)', marginTop: '6px', fontWeight: 500 }}>
                ⚡ Auto-compressed
              </span>
            </div>

            {/* Right Column: Driver Name & Phone inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Driver Full Name *
                </label>
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  style={{ width: '100%', padding: '10px 14px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Phone / Contact No. (optional)
                </label>
                <input
                  type="text"
                  value={newPersonPhone}
                  onChange={(e) => setNewPersonPhone(e.target.value)}
                  placeholder="0917-xxx-xxxx"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveDriver}
            className="btn btn-primary"
            disabled={savingPersonnel || !newPersonName.trim()}
            style={{
              width: '100%',
              marginTop: '4px',
              padding: '12px',
              opacity: (savingPersonnel || !newPersonName.trim()) ? 0.45 : 1,
              cursor: (savingPersonnel || !newPersonName.trim()) ? 'not-allowed' : 'pointer',
              background: (savingPersonnel || !newPersonName.trim()) ? 'rgba(255, 255, 255, 0.08)' : 'var(--accent-primary)',
              color: (savingPersonnel || !newPersonName.trim()) ? 'var(--text-muted)' : 'white',
              boxShadow: (savingPersonnel || !newPersonName.trim()) ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            {savingPersonnel ? 'Saving Driver...' : 'Add & Select Driver'}
          </button>
        </div>
      </Modal>

      {/* ─── ADD HELPER MODAL ─── */}
      <Modal isOpen={isAddHelperModalOpen} onClose={() => setIsAddHelperModalOpen(false)} title="Add New Helper" maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '20px', alignItems: 'stretch' }}>
            {/* Left Column: 130x130 Photo Upload Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                onClick={() => helperFileInputRef.current?.click()}
                className="glass-panel hover-bright"
                style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '16px',
                  border: newPersonPhoto ? '2px solid var(--accent-success)' : '2px dashed var(--border)',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: newPersonPhoto ? '#000' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.25s ease',
                  boxShadow: newPersonPhoto ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                {newPersonPhoto ? (
                  <>
                    <img src={newPersonPhoto} alt="Helper Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <Camera size={20} color="white" />
                      <span style={{ fontSize: '10px', color: 'white', fontWeight: 600 }}>Change</span>
                    </div>
                    {/* Clear Photo Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewPersonPhoto('');
                        if (helperFileInputRef.current) helperFileInputRef.current.value = '';
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(239, 68, 68, 0.85)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        cursor: 'pointer',
                        zIndex: 10,
                      }}
                      title="Remove Photo"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={24} style={{ color: 'var(--accent-success)' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Upload Photo</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={helperFileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--accent-success)', marginTop: '6px', fontWeight: 500 }}>
                ⚡ Auto-compressed
              </span>
            </div>

            {/* Right Column: Helper Name & Phone inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Helper Full Name *
                </label>
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="e.g. Pedro Santos"
                  style={{ width: '100%', padding: '10px 14px' }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Phone / Contact No. (optional)
                </label>
                <input
                  type="text"
                  value={newPersonPhone}
                  onChange={(e) => setNewPersonPhone(e.target.value)}
                  placeholder="0918-xxx-xxxx"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveHelper}
            className="btn btn-primary"
            disabled={savingPersonnel || !newPersonName.trim()}
            style={{
              width: '100%',
              marginTop: '4px',
              padding: '12px',
              opacity: (savingPersonnel || !newPersonName.trim()) ? 0.45 : 1,
              cursor: (savingPersonnel || !newPersonName.trim()) ? 'not-allowed' : 'pointer',
              background: (savingPersonnel || !newPersonName.trim()) ? 'rgba(255, 255, 255, 0.08)' : 'var(--accent-success)',
              color: (savingPersonnel || !newPersonName.trim()) ? 'var(--text-muted)' : 'white',
              boxShadow: (savingPersonnel || !newPersonName.trim()) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            {savingPersonnel ? 'Saving Helper...' : 'Add & Select Helper'}
          </button>
        </div>
      </Modal>

      {/* ─── EDIT PERSONNEL MODAL ─── */}
      <Modal
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        title={editingPerson?.type === 'driver' ? 'Edit Driver Profile' : 'Edit Helper Profile'}
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '20px', alignItems: 'stretch' }}>
            {/* Left Column: 130x130 Photo Upload Box */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                onClick={() => editFileInputRef.current?.click()}
                className="glass-panel hover-bright"
                style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '16px',
                  border: editPersonPhoto
                    ? `2px solid ${editingPerson?.type === 'driver' ? 'var(--accent-primary)' : 'var(--accent-success)'}`
                    : '2px dashed var(--border)',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: editPersonPhoto ? '#000' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.25s ease',
                  boxShadow: editPersonPhoto
                    ? `0 0 20px ${editingPerson?.type === 'driver' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`
                    : 'none',
                }}
              >
                {editPersonPhoto ? (
                  <>
                    <img src={editPersonPhoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <Camera size={20} color="white" />
                      <span style={{ fontSize: '10px', color: 'white', fontWeight: 600 }}>Change</span>
                    </div>
                    {/* Clear Photo Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditPersonPhoto('');
                        if (editFileInputRef.current) editFileInputRef.current.value = '';
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(239, 68, 68, 0.85)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        cursor: 'pointer',
                        zIndex: 10,
                      }}
                      title="Remove Photo"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', padding: '12px', textAlign: 'center' }}>
                    <div style={{ background: editingPerson?.type === 'driver' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={24} style={{ color: editingPerson?.type === 'driver' ? 'var(--accent-primary)' : 'var(--accent-success)' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Upload Photo</span>
                  </div>
                )}
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  onChange={handleEditImageFileChange}
                  style={{ display: 'none' }}
                />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--accent-success)', marginTop: '6px', fontWeight: 500 }}>
                ⚡ Auto-compressed
              </span>
            </div>

            {/* Right Column: Personnel Name & Phone inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  {editingPerson?.type === 'driver' ? 'Driver Full Name *' : 'Helper Full Name *'}
                </label>
                <input
                  type="text"
                  value={editPersonName}
                  onChange={(e) => setEditPersonName(e.target.value)}
                  placeholder="Full Name"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Phone / Contact No. (optional)
                </label>
                <input
                  type="text"
                  value={editPersonPhone}
                  onChange={(e) => setEditPersonPhone(e.target.value)}
                  placeholder="Contact Number"
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={handleDeletePerson}
              disabled={isDeletingPerson || isSavingEdit}
              className="btn"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--accent-danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '10px 16px',
                fontSize: '13px',
              }}
            >
              <Trash2 size={16} /> {isDeletingPerson ? 'Deleting...' : 'Delete Record'}
            </button>

            <button
              onClick={handleSavePersonEdit}
              disabled={isSavingEdit || isDeletingPerson || !editPersonName.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                opacity: (!editPersonName.trim() || isSavingEdit) ? 0.45 : 1,
                cursor: (!editPersonName.trim() || isSavingEdit) ? 'not-allowed' : 'pointer',
                background: (!editPersonName.trim() || isSavingEdit)
                  ? 'rgba(255, 255, 255, 0.08)'
                  : editingPerson?.type === 'driver' ? 'var(--accent-primary)' : 'var(--accent-success)',
              }}
            >
              <Save size={16} /> {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ManningPage;
