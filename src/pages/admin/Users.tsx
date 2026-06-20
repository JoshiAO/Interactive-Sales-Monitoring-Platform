import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeams } from '../../hooks/useTeams';
import { Modal } from '../../components/ui/Modal';
import { UserPlus, Edit2, Trash2, Mail, Camera, Loader2 } from 'lucide-react';
import { db, storage, firebaseConfig } from '../../firebase/config';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg } from '../../utils/cropImage';

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  salesmanId: string;
  team: string;
  salesmanType: string;
  companyCode: string;
  photoURL: string;
  supervisor: string;
  branch?: string;
};

const Users: React.FC = () => {
  const { companyCode } = useAuth();
  const availableTeams = useTeams();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState<string | null>(null);
  
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('All Teams');

  // Cropper states
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropUserId, setCropUserId] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', role: 'salesman', team: '', salesmanType: 'Ex-Truck', salesmanId: '', supervisor: '', branch: ''
  });

  const roles = ['admin', 'manager', 'supervisor', 'salesman', 'warehouse_supervisor'];
  const availableSupervisors = users.filter(u => u.role === 'supervisor');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const data: UserData[] = [];
      snap.forEach(d => {
        const u = d.data();
        data.push({
          id: d.id,
          name: u.name || '',
          email: u.email || '',
          role: u.role || 'salesman',
          salesmanId: u.salesmanId || '-',
          team: u.team || '-',
          salesmanType: u.salesmanType || '-',
          companyCode: u.companyCode || '-',
          photoURL: u.photoURL || '',
          supervisor: u.supervisor || '-',
          branch: u.branch || ''
        });
      });
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this user? (Note: Auth deletion requires Cloud Functions. This only removes the database record.)')) {
      await deleteDoc(doc(db, 'users', id));
      await setDoc(doc(db, 'settings', 'global'), { lastUserUpdate: Date.now() }, { merge: true });
    }
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      team: user.team === '-' ? '' : user.team,
      salesmanId: user.salesmanId === '-' ? '' : user.salesmanId,
      salesmanType: user.salesmanType === '-' ? 'Ex-Truck' : user.salesmanType,
      supervisor: user.supervisor === '-' ? '' : user.supervisor,
      branch: user.branch || ''
    });
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'salesman', team: '', salesmanType: 'Ex-Truck', salesmanId: '', supervisor: '', branch: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingUser && formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (editingUser && formData.password && formData.password !== formData.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!editingUser) {
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
          const newUid = userCredential.user.uid;
          
          await setDoc(doc(db, 'users', newUid), {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            team: (formData.role === 'salesman' || formData.role === 'supervisor') ? (formData.team || '-') : '-',
            salesmanId: formData.salesmanId || '-',
            salesmanType: formData.salesmanType || '-',
            companyCode: companyCode || '-',
            supervisor: formData.role === 'salesman' ? (formData.supervisor || '-') : '-',
            branch: formData.role === 'warehouse_supervisor' ? (formData.branch || '') : '',
            photoURL: ''
          });
        } finally {
          await deleteApp(secondaryApp);
        }
      } else {
        await updateDoc(doc(db, 'users', editingUser.id), {
          name: formData.name,
          role: formData.role,
          team: (formData.role === 'salesman' || formData.role === 'supervisor') ? (formData.team || '-') : '-',
          salesmanId: formData.salesmanId || '-',
          salesmanType: formData.salesmanType || '-',
          supervisor: formData.role === 'salesman' ? (formData.supervisor || '-') : '-',
          branch: formData.role === 'warehouse_supervisor' ? (formData.branch || '') : ''
        });

        if (formData.password) {
          const functions = getFunctions();
          const changeUserPassword = httpsCallable(functions, 'changeUserPassword');
          await changeUserPassword({ uid: editingUser.id, newPassword: formData.password });
          alert("User updated and password changed successfully!");
        }
      }
      await setDoc(doc(db, 'settings', 'global'), { lastUserUpdate: Date.now() }, { merge: true });
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (userId: string, file: File) => {
    setUploadingAvatar(userId);
    try {
      const storageRef = ref(storage, `profile_pictures/${userId}/avatar`);
      
      // Set cache control so avatars are heavily cached by the browser
      const metadata = {
        cacheControl: 'public, max-age=31536000',
      };
      
      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);
      const urlWithCacheBuster = `${url}&t=${Date.now()}`;
      await updateDoc(doc(db, 'users', userId), { photoURL: urlWithCacheBuster });
      await setDoc(doc(db, 'settings', 'global'), { lastUserUpdate: Date.now() }, { merge: true });
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingAvatar(null);
    }
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !cropUserId) return;
    try {
      const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
      handleAvatarUpload(cropUserId, file);
    } catch (e: any) {
      alert("Error cropping image: " + e.message);
    } finally {
      setCropImageSrc(null);
      setCropUserId(null);
    }
  };

  const handleFileChange = (userId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCropImageSrc(reader.result?.toString() || null);
        setCropUserId(userId);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleFixRoles = async () => {
    if (confirm('Are you sure you want to fix missing roles? This will assign the "salesman" role to any user who has no role in the database.')) {
      setIsSubmitting(true);
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        let count = 0;
        const updates: Promise<void>[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.role) {
            updates.push(updateDoc(docSnap.ref, { role: 'salesman' }));
            count++;
          }
        });
        await Promise.all(updates);
        alert(`Successfully fixed ${count} users with missing roles.`);
        if (count > 0) {
          await setDoc(doc(db, 'settings', 'global'), { lastUserUpdate: Date.now() }, { merge: true });
        }
      } catch (err: any) {
        alert("Error fixing roles: " + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '50vh', color: 'var(--accent-primary)' }}>
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>User Management</h2>
          <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0' }}>Manage platform access and roles.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleFixRoles} className="btn" disabled={isSubmitting} style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
             Fix Missing Roles
          </button>
          <button onClick={handleCreate} className="btn btn-primary" disabled={isSubmitting}>
            <UserPlus size={18} /> Add User
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {roles.map(role => {
          const roleUsers = users.filter(u => u.role === role);
          if (roleUsers.length === 0) return null;

          return (
            <div key={role}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', gap: '16px' }}>
                <h3 style={{ textTransform: 'capitalize', margin: 0, color: 'var(--text-muted)' }}>
                  {role === 'salesman' ? 'Salesmen' : role === 'warehouse_supervisor' ? 'Warehouse Supervisors' : `${role}s`} ({role === 'salesman' && selectedTeamFilter !== 'All Teams' ? roleUsers.filter(u => u.team === selectedTeamFilter).length : roleUsers.length})
                </h3>
                {role === 'salesman' && availableTeams.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {availableTeams.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTeamFilter(t)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '16px',
                          border: '1px solid',
                          borderColor: selectedTeamFilter === t ? 'var(--accent-primary)' : 'var(--border)',
                          backgroundColor: selectedTeamFilter === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                          color: selectedTeamFilter === t ? '#fff' : 'var(--text-muted)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                    {selectedTeamFilter !== 'All Teams' && (
                      <button
                        onClick={() => setSelectedTeamFilter('All Teams')}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {roleUsers.filter(u => role !== 'salesman' || selectedTeamFilter === 'All Teams' || u.team === selectedTeamFilter).map(user => (
                  <div key={user.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ position: 'relative' }}>
                        {user.photoURL ? (
                           <img src={user.photoURL} alt={user.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                           <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                             {user.name.charAt(0).toUpperCase()}
                           </div>
                        )}
                        <label style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: 'var(--bg-panel)', borderRadius: '50%', padding: '4px', cursor: 'pointer', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {uploadingAvatar === user.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} color="var(--text-muted)" />}
                          <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => {
                            handleFileChange(user.id, e);
                            e.target.value = '';
                          }} />
                        </label>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: '16px' }}>{user.name}</h4>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', wordBreak: 'break-all' }}>
                          <Mail size={12} style={{ flexShrink: 0 }} /> {user.email}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Company Code:</span>
                        <span>{user.companyCode}</span>
                      </div>
                      {role === 'salesman' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Salesman ID:</span>
                            <span>{user.salesmanId}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Type:</span>
                            <span style={{ color: 'var(--accent-primary)' }}>{user.salesmanType}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Supervisor:</span>
                            <span>{availableSupervisors.find(s => s.id === user.supervisor)?.name || user.supervisor}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Team:</span>
                            <span>{user.team}</span>
                          </div>
                        </>
                      )}
                      {role === 'warehouse_supervisor' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Branch:</span>
                          <span>{user.branch}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <button onClick={() => handleEdit(user)} className="btn" style={{ flex: 1, backgroundColor: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                        <Edit2 size={16} /> Edit
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="btn" style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid transparent' }}>
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'Edit User' : 'Create New User'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ width: '100%' }} className="input-field" />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required disabled={!!editingUser} style={{ width: '100%', opacity: editingUser ? 0.5 : 1 }} className="input-field" />
          </div>
          
          {!editingUser ? (
            <>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Password</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required style={{ width: '100%' }} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Confirm Password</label>
                <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required style={{ width: '100%' }} className="input-field" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Change Password (Optional)</label>
                <input type="password" placeholder="Leave blank to keep current password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={{ width: '100%' }} className="input-field" />
              </div>
              {formData.password && (
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Confirm New Password</label>
                  <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} required style={{ width: '100%' }} className="input-field" />
                </div>
              )}
            </>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Role</label>
            <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} style={{ width: '100%' }} className="glass-panel">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="salesman">Salesman</option>
              <option value="warehouse_supervisor">Warehouse Supervisor</option>
            </select>
          </div>

          {(formData.role === 'salesman' || formData.role === 'supervisor') && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                {formData.role === 'supervisor' ? 'Teams' : 'Team'}
              </label>
              {formData.role === 'supervisor' ? (
                <div className="glass-panel" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '12px 8px', 
                  padding: '16px',
                  maxHeight: '200px', 
                  overflowY: 'auto' 
                }}>
                  {availableTeams.map(t => {
                    const isChecked = formData.team ? formData.team.split(',').includes(t) : false;
                    return (
                      <label key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '13px', margin: 0, color: 'var(--text-primary)' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            const currentTeams = formData.team ? formData.team.split(',') : [];
                            let newTeams;
                            if (e.target.checked) {
                              newTeams = [...currentTeams, t];
                            } else {
                              newTeams = currentTeams.filter(team => team !== t);
                            }
                            setFormData({...formData, team: newTeams.join(',')});
                          }}
                          style={{ cursor: 'pointer', margin: 0, flexShrink: 0, width: '16px', height: '16px' }}
                        />
                        <span style={{ lineHeight: '1.2', wordBreak: 'break-word', marginTop: '2px' }}>{t}</span>
                      </label>
                    );
                  })}
                  {availableTeams.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', gridColumn: '1 / -1' }}>No teams available</div>
                  )}
                </div>
              ) : (
                <select 
                  value={formData.team} 
                  onChange={e => setFormData({...formData, team: e.target.value})} 
                  style={{ width: '100%' }} 
                  className="glass-panel"
                  required
                >
                  <option value="" disabled>Select a team...</option>
                  {availableTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {formData.role === 'warehouse_supervisor' && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Branch</label>
              <input type="text" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value.toUpperCase()})} placeholder="e.g. KEA, KNE" style={{ width: '100%', textTransform: 'uppercase' }} className="input-field" />
            </div>
          )}
          
          {formData.role === 'salesman' && (
            <>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Supervisor</label>
                <select 
                  value={formData.supervisor} 
                  onChange={e => setFormData({...formData, supervisor: e.target.value})} 
                  style={{ width: '100%' }} 
                  className="glass-panel"
                  required
                >
                  <option value="" disabled>Select a supervisor...</option>
                  {availableSupervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Salesman ID</label>
                <input type="text" value={formData.salesmanId} onChange={e => setFormData({...formData, salesmanId: e.target.value})} placeholder="e.g. KNE0001" style={{ width: '100%' }} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Salesman Type</label>
                <select value={formData.salesmanType} onChange={e => setFormData({...formData, salesmanType: e.target.value})} style={{ width: '100%' }} className="glass-panel">
                  <option value="Ex-Truck">Ex-Truck</option>
                  <option value="Booking">Booking</option>
                </select>
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (editingUser ? 'Save Changes' : 'Create User')}
          </button>
        </form>
      </Modal>

      <Modal isOpen={!!cropImageSrc} onClose={() => { setCropImageSrc(null); setCropUserId(null); }} title="Crop Profile Picture">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '100%', height: '300px', backgroundColor: '#1a1a2e', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
            {cropImageSrc && (
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Zoom:</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => { setCropImageSrc(null); setCropUserId(null); }} className="btn" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button onClick={handleSaveCrop} className="btn btn-primary">
              Save & Upload
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Users;
