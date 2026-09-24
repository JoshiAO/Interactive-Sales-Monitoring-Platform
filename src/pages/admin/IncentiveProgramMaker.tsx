import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Edit2, Save, Image as ImageIcon, Loader2, X, Archive, Check, Minus, Crop, Download, FileSpreadsheet, ArrowLeft, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { ImageCropperModal } from '../../components/ui/ImageCropperModal';
import type { CropSettings } from '../../utils/cropUtils';
import { recalculateIncentiveAchievements } from '../../utils/recalculateIncentives';

export interface SubProductGroup {
  id: string;
  name: string;
  items: string[];
  targetValue?: number;
  individualTargets?: Record<string, any>;
}

export interface TrackingGroup {
  id: string;
  name: string;
  definitionType: 'category' | 'products' | 'new_customer';
  items: string[];
  targetType: 'STT' | 'UBA';
  targetValue?: number;
  individualTargets?: Record<string, any>;
  minDropSize: number;
  ubaMeasureType?: 'Month-on-month' | 'Everbought';
  channels?: string[];
  enableDailyBreakdown?: boolean;
  hasSubGroups?: boolean;
  subGroups?: Record<string, SubProductGroup>;
  overrideSalesmen?: boolean;
  participatingSalesmen?: string[];
}

export interface IncentiveProgram {
  id: string;
  title: string;
  description: string;
  startMonth: string;
  endMonth: string;
  status: string;
  bannerUrl: string;
  cropSettings?: CropSettings;
  trackingGroups: Record<string, TrackingGroup>;
  participatingSalesmen: string[];
}

const IncentiveProgramMaker: React.FC = () => {
  const [programs, setPrograms] = useState<IncentiveProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleRecalculateAchievements = async () => {
    setRecalculating(true);
    try {
      await recalculateIncentiveAchievements();
      alert("Incentive achievements successfully recalculated!");
    } catch (err: any) {
      alert("Failed to recalculate incentive achievements: " + (err.message || err));
    } finally {
      setRecalculating(false);
    }
  };
  const [showModal, setShowModal] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string>('');
  const [formData, setFormData] = useState<Partial<IncentiveProgram>>({
    status: 'active',
    trackingGroups: {},
    participatingSalesmen: []
  });
  const [salesmen, setSalesmen] = useState<{id: string, name: string, code: string, team: string, branch: string}[]>([]);
  const [salesmanSearch, setSalesmanSearch] = useState('');
  
  const [categories, setCategories] = useState<string[]>([]);
  const [channelsList, setChannelsList] = useState<string[]>([]);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});

  const [selectorModal, setSelectorModal] = useState<{ groupId: string, subGroupId?: string, type: 'category' | 'channel' | 'product' } | null>(null);
  const [selectorSearch, setSelectorSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');
  
  const [individualTargetsModal, setIndividualTargetsModal] = useState<string | null>(null);
  const [individualTargetsSubGroup, setIndividualTargetsSubGroup] = useState<string>('all');
  const [individualTargetsSearch, setIndividualTargetsSearch] = useState('');
  const [individualTargetsSort, setIndividualTargetsSort] = useState<'name' | 'code'>('name');
  const [individualTargetsBranches, setIndividualTargetsBranches] = useState<string[]>([]);
  const [individualTargetsMonth, setIndividualTargetsMonth] = useState<string>('');

  const getMonthsBetween = (start?: string, end?: string) => {
    if (!start || !end) return [];
    const months = [];
    let current = new Date(`${start}-01`);
    const endDate = new Date(`${end}-01`);
    while (current <= endDate) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${yyyy}-${mm}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  const availableMonths = getMonthsBetween(formData.startMonth, formData.endMonth);

  useEffect(() => {
    if (individualTargetsModal && availableMonths.length > 0 && !availableMonths.includes(individualTargetsMonth)) {
      setIndividualTargetsMonth(availableMonths[0]);
    }
  }, [individualTargetsModal, formData.startMonth, formData.endMonth]);

  const handleAddTrackingGroup = () => {
    const newId = `group_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      trackingGroups: {
        ...prev.trackingGroups,
        [newId]: {
          id: newId,
          name: '',
          definitionType: 'category',
          items: [],
          targetType: 'STT',
          minDropSize: 0,
          ubaMeasureType: 'Month-on-month',
          enableDailyBreakdown: false,
          createdAt: Date.now()
        }
      }
    }));
  };

  const handleUpdateTrackingGroup = (id: string, updates: Partial<TrackingGroup>) => {
    setFormData(prev => ({
      ...prev,
      trackingGroups: {
        ...prev.trackingGroups,
        [id]: { ...prev.trackingGroups![id], ...updates }
      }
    }));
  };

  const handleDeleteTrackingGroup = (id: string) => {
    setFormData(prev => {
      const newGroups = { ...prev.trackingGroups };
      delete newGroups[id];
      return { ...prev, trackingGroups: newGroups };
    });
  };

  const handleAddSubGroup = (groupId: string) => {
    const newSubId = `sub_${Date.now()}`;
    setFormData(prev => {
      const group = prev.trackingGroups?.[groupId];
      if (!group) return prev;
      const subGroups = group.subGroups || {};
      return {
        ...prev,
        trackingGroups: {
          ...prev.trackingGroups,
          [groupId]: {
            ...group,
            hasSubGroups: true,
            subGroups: {
              ...subGroups,
              [newSubId]: {
                id: newSubId,
                name: '',
                items: [],
                individualTargets: {}
              }
            }
          }
        }
      };
    });
  };

  const handleUpdateSubGroup = (groupId: string, subGroupId: string, updates: Partial<SubProductGroup>) => {
    setFormData(prev => {
      const group = prev.trackingGroups?.[groupId];
      if (!group || !group.subGroups?.[subGroupId]) return prev;
      return {
        ...prev,
        trackingGroups: {
          ...prev.trackingGroups,
          [groupId]: {
            ...group,
            subGroups: {
              ...group.subGroups,
              [subGroupId]: {
                ...group.subGroups[subGroupId],
                ...updates
              }
            }
          }
        }
      };
    });
  };

  const handleDeleteSubGroup = (groupId: string, subGroupId: string) => {
    setFormData(prev => {
      const group = prev.trackingGroups?.[groupId];
      if (!group || !group.subGroups) return prev;
      const newSub = { ...group.subGroups };
      delete newSub[subGroupId];
      return {
        ...prev,
        trackingGroups: {
          ...prev.trackingGroups,
          [groupId]: {
            ...group,
            subGroups: newSub,
            hasSubGroups: Object.keys(newSub).length > 0
          }
        }
      };
    });
  };

  const toggleGroupSalesman = (groupId: string, salesmanId: string) => {
    setFormData(prev => {
      const group = prev.trackingGroups?.[groupId];
      if (!group) return prev;
      const current = group.participatingSalesmen || [];
      const updated = current.includes(salesmanId)
        ? current.filter(x => x !== salesmanId)
        : [...current, salesmanId];
      return {
        ...prev,
        trackingGroups: {
          ...prev.trackingGroups,
          [groupId]: {
            ...group,
            participatingSalesmen: updated
          }
        }
      };
    });
  };

  const handleExportModalTargetTemplate = (group: any, subGroup: any, selectedMonth?: string) => {
    const isEverbought = group?.ubaMeasureType === 'Everbought';
    const subGroupsList = (group?.hasSubGroups && !subGroup) ? Object.values(group?.subGroups || {}) as any[] : [];

    let participatingSalesmenIds: string[] = [];
    if (subGroup?.participatingSalesmen?.length) {
      participatingSalesmenIds = subGroup.participatingSalesmen;
    } else if (group?.participatingSalesmen?.length) {
      participatingSalesmenIds = group.participatingSalesmen;
    } else if (formData.participatingSalesmen?.length) {
      participatingSalesmenIds = formData.participatingSalesmen;
    } else {
      participatingSalesmenIds = salesmen.map(s => s.id);
    }

    if (participatingSalesmenIds.length === 0) {
      participatingSalesmenIds = salesmen.map(s => s.id);
    }

    const scopeName = subGroup ? `${group.name} - ${subGroup.name}` : group.name;

    if (subGroupsList.length > 0) {
      // Export template for all Sub-Product Groups as columns
      const headers = [
        'Salesman Code',
        'Salesman Name',
        'Branch',
        ...subGroupsList.map((s: any) => `${s.name || 'Sub-Group'} Target ${selectedMonth && !isEverbought ? `(${selectedMonth})` : (group?.targetType === 'STT' ? '(PHP)' : '(CS)')}`)
      ];
      const rows: (string | number)[][] = [headers];

      participatingSalesmenIds.forEach((salesmanId: string) => {
        const salesmanInfo = salesmen.find(s => s.id === salesmanId);
        const name = salesmanInfo ? salesmanInfo.name : salesmanId;
        const branch = salesmanInfo ? (salesmanInfo.branch || salesmanInfo.team || '') : '';

        const rowData: (string | number)[] = [salesmanId, name, branch];

        subGroupsList.forEach((sub: any) => {
          const targets = sub.individualTargets || {};
          let currentTarget: number | string = '';
          const data = targets[salesmanId];
          if (selectedMonth && !isEverbought) {
            if (typeof data === 'object' && data !== null && data[selectedMonth] !== undefined) {
              currentTarget = Number(data[selectedMonth]);
            }
          } else {
            if (typeof data === 'number') {
              currentTarget = data;
            } else if (typeof data === 'object' && data !== null && data['flat'] !== undefined) {
              currentTarget = Number(data['flat']);
            }
          }
          rowData.push(currentTarget);
        });

        rows.push(rowData);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 32 },
        { wch: 22 },
        ...subGroupsList.map(() => ({ wch: 26 }))
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Targets");

      const cleanScope = scopeName.replace(/[^a-z0-9]/gi, '_');
      const cleanMonth = selectedMonth && !isEverbought ? `_${selectedMonth}` : '';
      XLSX.writeFile(wb, `${(formData.title || 'Incentive').replace(/[^a-z0-9]/gi, '_')}_${cleanScope}${cleanMonth}_SubGroups_Targets.xlsx`);
      return;
    }

    const targetContainer = subGroup || group;
    const targets = targetContainer?.individualTargets || {};

    const headerTargetName = selectedMonth && !isEverbought
      ? `Target (${selectedMonth})`
      : `Target ${group?.targetType === 'STT' ? '(PHP)' : '(CS)'}`;

    const headers = ['Salesman Code', 'Salesman Name', 'Branch', headerTargetName];
    const rows: (string | number)[][] = [headers];

    participatingSalesmenIds.forEach((salesmanId: string) => {
      const salesmanInfo = salesmen.find(s => s.id === salesmanId);
      const name = salesmanInfo ? salesmanInfo.name : salesmanId;
      const branch = salesmanInfo ? (salesmanInfo.branch || salesmanInfo.team || '') : '';

      let currentTarget: number | string = '';
      const data = targets[salesmanId];
      if (selectedMonth && !isEverbought) {
        if (typeof data === 'object' && data !== null && data[selectedMonth] !== undefined) {
          currentTarget = Number(data[selectedMonth]);
        }
      } else {
        if (typeof data === 'number') {
          currentTarget = data;
        } else if (typeof data === 'object' && data !== null && data['flat'] !== undefined) {
          currentTarget = Number(data['flat']);
        }
      }

      rows.push([salesmanId, name, branch, currentTarget]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths for a polished Excel file layout
    ws['!cols'] = [
      { wch: 18 }, // Salesman Code
      { wch: 32 }, // Salesman Name
      { wch: 22 }, // Branch
      { wch: 24 }  // Target
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Targets");

    const cleanScope = scopeName.replace(/[^a-z0-9]/gi, '_');
    const cleanMonth = selectedMonth && !isEverbought ? `_${selectedMonth}` : '';
    XLSX.writeFile(wb, `${(formData.title || 'Incentive').replace(/[^a-z0-9]/gi, '_')}_${cleanScope}${cleanMonth}_Targets.xlsx`);
  };

  const handleImportModalTargetFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    groupId: string,
    subGroupId?: string,
    selectedMonth?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length < 2) {
          alert("Excel file is empty or invalid.");
          return;
        }

        const headers = data[0].map(h => String(h || '').trim());
        const codeIdx = headers.findIndex(h => h.toLowerCase().includes('code') || h.toLowerCase().includes('salesman'));

        if (codeIdx === -1) {
          alert("Excel must have a 'Salesman Code' column.");
          return;
        }

        const group = formData.trackingGroups?.[groupId];
        if (!group) return;

        const isEverbought = group.ubaMeasureType === 'Everbought';
        const trackingGroups = JSON.parse(JSON.stringify(formData.trackingGroups || {}));
        const subGroupsList = (group.hasSubGroups && !subGroupId) ? Object.values(group.subGroups || {}) as any[] : [];

        if (subGroupsList.length > 0) {
          // Multi Sub-Group Import
          const subGroupColMap: { subId: string, colIdx: number }[] = [];
          subGroupsList.forEach((sub: any, sIdx: number) => {
            let colIdx = headers.findIndex(h => h.toLowerCase().includes((sub.name || '').toLowerCase()));
            if (colIdx === -1) {
              if (headers.length > 3 + sIdx) colIdx = 3 + sIdx;
            }
            if (colIdx !== -1 && colIdx !== codeIdx) {
              subGroupColMap.push({ subId: sub.id, colIdx });
            }
          });

          if (subGroupColMap.length === 0) {
            alert("Could not match columns in Excel to Sub-Product Groups.");
            return;
          }

          let updatedCount = 0;
          for (let r = 1; r < data.length; r++) {
            const row = data[r];
            if (!row || !row[codeIdx]) continue;
            const salesmanCode = String(row[codeIdx]).trim();

            subGroupColMap.forEach(({ subId, colIdx }) => {
              const rawVal = row[colIdx];
              if (rawVal === undefined || rawVal === '') return;

              const val = Number(rawVal);
              if (isNaN(val)) return;

              const targetSubGroup = trackingGroups[groupId]?.subGroups?.[subId];
              if (targetSubGroup) {
                const existingIndiv = { ...(targetSubGroup.individualTargets || {}) };
                const currentSalesmanTarget = existingIndiv[salesmanCode];

                if (selectedMonth && !isEverbought) {
                  const monthMap = (typeof currentSalesmanTarget === 'object' && currentSalesmanTarget !== null)
                    ? { ...currentSalesmanTarget }
                    : (typeof currentSalesmanTarget === 'number' && currentSalesmanTarget > 0 ? { flat: currentSalesmanTarget } : {});
                  monthMap[selectedMonth] = val;
                  existingIndiv[salesmanCode] = monthMap;
                } else {
                  existingIndiv[salesmanCode] = val;
                }

                targetSubGroup.individualTargets = existingIndiv;
              }
            });
            updatedCount++;
          }

          setFormData(prev => ({ ...prev, trackingGroups }));
          alert(`Successfully imported targets for ${updatedCount} salesmen across ${subGroupColMap.length} sub-product groups!`);
          return;
        }

        let targetIdx = headers.findIndex(h => h.toLowerCase().includes('target'));
        if (targetIdx === -1 && headers.length >= 4) targetIdx = 3;
        if (targetIdx === -1 && headers.length > 1) targetIdx = headers.length - 1;

        if (targetIdx === -1) {
          alert("Excel must have a 'Target' column.");
          return;
        }

        let updatedCount = 0;

        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          if (!row || !row[codeIdx]) continue;
          const salesmanCode = String(row[codeIdx]).trim();
          const rawVal = row[targetIdx];
          if (rawVal === undefined || rawVal === '') continue;

          const val = Number(rawVal);
          if (isNaN(val)) continue;

          const targetContainer = (subGroupId && trackingGroups[groupId]?.subGroups?.[subGroupId])
            ? trackingGroups[groupId].subGroups[subGroupId]
            : trackingGroups[groupId];

          if (targetContainer) {
            const existingIndiv = { ...(targetContainer.individualTargets || {}) };
            const currentSalesmanTarget = existingIndiv[salesmanCode];

            if (selectedMonth && !isEverbought) {
              const monthMap = (typeof currentSalesmanTarget === 'object' && currentSalesmanTarget !== null)
                ? { ...currentSalesmanTarget }
                : (typeof currentSalesmanTarget === 'number' && currentSalesmanTarget > 0 ? { flat: currentSalesmanTarget } : {});
              monthMap[selectedMonth] = val;
              existingIndiv[salesmanCode] = monthMap;
            } else {
              existingIndiv[salesmanCode] = val;
            }

            targetContainer.individualTargets = existingIndiv;
            updatedCount++;
          }
        }

        setFormData(prev => ({ ...prev, trackingGroups }));
        alert(`Successfully imported targets for ${updatedCount} salesmen!`);
      } catch (err) {
        console.error("Failed to parse modal target Excel file:", err);
        alert("Failed to import Excel file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const toggleSalesman = (id: string) => {
    setFormData(prev => {
      const curr = prev.participatingSalesmen || [];
      if (curr.includes(id)) return { ...prev, participatingSalesmen: curr.filter(x => x !== id) };
      return { ...prev, participatingSalesmen: [...curr, id] };
    });
  };

  const toggleAllSalesmen = () => {
    setFormData(prev => {
      if ((prev.participatingSalesmen || []).length === salesmen.length) {
        return { ...prev, participatingSalesmen: [] };
      }
      return { ...prev, participatingSalesmen: salesmen.map(s => s.id) };
    });
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalImageUrl(objectUrl);
    setPendingFile(file);
    setShowCropper(true);
  };

  const handleCropComplete = async (crops: CropSettings) => {
    setShowCropper(false);
    if (!pendingFile) {
      setFormData(prev => ({ ...prev, cropSettings: crops }));
      setLocalImageUrl('');
      return;
    }

    setUploadingImage(true);
    try {
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(pendingFile);
        reader.onload = event => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => {
              if (blob) resolve(new File([blob], pendingFile.name, { type: 'image/jpeg' }));
              else reject(new Error('Compression failed'));
            }, 'image/jpeg', 0.8);
          };
        };
      });

      const storageRef = ref(storage, `incentives_banners/${Date.now()}_${compressedFile.name}`);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      
      setFormData(prev => ({ ...prev, bannerUrl: url, cropSettings: crops }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
      setPendingFile(null);
      URL.revokeObjectURL(localImageUrl);
      setLocalImageUrl('');
    }
  };

  const handleSaveProgram = async () => {
    if (!formData.title || !formData.startMonth || !formData.endMonth) {
      alert("Title and duration are required.");
      return;
    }
    setSaving(true);
    try {
      const docId = formData.id || `prog_${Date.now()}`;
      
      // Ensure ubaMeasureType is explicitly saved for UBA targets even if untouched by the user
      const processedTrackingGroups = { ...formData.trackingGroups };
      Object.keys(processedTrackingGroups).forEach(groupId => {
        if (processedTrackingGroups[groupId].targetType === 'UBA' || processedTrackingGroups[groupId].targetType === 'Mixed' as any) {
          if (!processedTrackingGroups[groupId].ubaMeasureType) {
            processedTrackingGroups[groupId].ubaMeasureType = 'Month-on-month';
          }
        }
      });

      const payload: Record<string, any> = { ...formData, trackingGroups: processedTrackingGroups, id: docId };
      
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      await setDoc(doc(db, 'incentives_programs', docId), payload);
      try {
        await recalculateIncentiveAchievements();
      } catch (e) {
        console.error("Auto recalculate error:", e);
      }
      setShowModal(false);
      setFormData({ status: 'active', trackingGroups: {}, participatingSalesmen: [], bannerUrl: '', cropSettings: undefined });
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to save program.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditProgram = (prog: IncentiveProgram) => {
    setFormData(prog);
    setShowModal(true);
  };

  const handleArchiveProgram = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this program?")) return;
    try {
      await updateDoc(doc(db, 'incentives_programs', id), { status: 'archived' });
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to archive program.");
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this program?")) return;
    try {
      await deleteDoc(doc(db, 'incentives_programs', id));
      fetchPrograms();
    } catch (err) {
      console.error(err);
      alert("Failed to delete program.");
    }
  };

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'incentives_programs'));
      const progs: IncentiveProgram[] = [];
      snap.forEach(d => {
        const data = d.data() as Omit<IncentiveProgram, 'id'>;
        progs.push({ id: d.id, ...data });
      });
      setPrograms(progs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesmen = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: {id: string, name: string, code: string, team: string, branch: string}[] = [];
      snap.forEach(d => {
        const u = d.data();
        if (u.role === 'salesman' && u.salesmanId) {
          list.push({ 
            id: String(u.salesmanId), 
            name: u.name || String(u.salesmanId),
            code: String(u.salesmanId),
            team: u.team || '',
            branch: u.branch || u.team || 'Unassigned'
          });
        }
      });
      setSalesmen(list.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error("Failed to fetch salesmen:", err);
    }
  };

  const fetchReferences = async () => {
    try {
      const [chanColSnap, mastSnap] = await Promise.all([
        getDocs(collection(db, 'reference_channels')),
        getDoc(doc(db, 'reference_masterlist', 'all'))
      ]);
      
      const chanSet = new Set<string>([
        'Sari-sari Stores - Large',
        'Sari-sari Stores - Small',
        'Groceries',
        'Supermarket',
        'Convenience Store',
        'Drugstore',
        'Wholesaler',
        'Institutional / Food Service',
        'Public Market / Wet Market Retailer'
      ]);
      chanColSnap.forEach(docSnap => {
        if (docSnap.id === 'all') {
          const chanData = docSnap.data();
          Object.values(chanData).forEach((row: any) => {
            if (typeof row === 'object' && row !== null) {
              const c = row.party_classification_description || row.channel || row['Channel'] || row['Channel_Classification'] || row['Channel Classification'] || row['Channel Description'] || row['Customer Channel'] || row.description || row.Description;
              if (c) {
                chanSet.add(String(c).trim());
              } else {
                Object.values(row).forEach(v => {
                  if (typeof v === 'string' && v.length > 2 && isNaN(Number(v))) {
                    chanSet.add(v.trim());
                  }
                });
              }
            } else if (typeof row === 'string') {
              chanSet.add(row.trim());
            }
          });
        } else {
          const row = docSnap.data();
          const c = row.party_classification_description || row.channel || row['Channel'] || row['Channel Description'] || row['Customer Channel'];
          if (c) chanSet.add(String(c).trim());
        }
      });
      setChannelsList(Array.from(chanSet).sort());

      const mastData = mastSnap.exists() ? mastSnap.data() : {};
      const catSet = new Set<string>();
      const pMap: Record<string, string> = {};
      const pCatMap: Record<string, string> = {};
      if (mastData.data) {
        const parsed = JSON.parse(mastData.data);
        Object.entries(parsed).forEach(([code, val]: any) => {
          if (val[0]) pMap[code] = val[0];
          if (val[1]) {
            catSet.add(val[1]);
            pCatMap[code] = val[1];
          }
        });
      }
      setCategories(Array.from(catSet).sort());
      setProductMap(pMap);
      setProductCategoryMap(pCatMap);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPrograms();
    fetchSalesmen();
    fetchReferences();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)' }}>Loading Programs...</div>;
  }

  const renderIndividualTargetsContent = () => {
    if (!individualTargetsModal) return null;
    const [gId, sId] = individualTargetsModal.split(':');
    const group = formData.trackingGroups?.[gId];
    if (!group) return null;
    
    const activeSubGroupId = individualTargetsSubGroup !== 'all' ? individualTargetsSubGroup : (sId || undefined);
    const subGroup = activeSubGroupId && group.subGroups ? group.subGroups[activeSubGroupId] : undefined;
    
    const participating = formData.participatingSalesmen || [];
    const targets = subGroup ? (subGroup.individualTargets || {}) : (group.individualTargets || {});

    const availableBranches = Array.from(new Set(salesmen.filter(s => participating.includes(s.id)).map(s => s.branch))).filter(Boolean).sort();

    const filteredParticipating = participating.filter(id => {
      const s = salesmen.find(x => x.id === id);
      if (!s) return false;
      const matchesSearch = s.name.toLowerCase().includes(individualTargetsSearch.toLowerCase()) || s.code.toLowerCase().includes(individualTargetsSearch.toLowerCase());
      const matchesBranch = individualTargetsBranches.length === 0 || individualTargetsBranches.includes(s.branch);
      return matchesSearch && matchesBranch;
    }).sort((a, b) => {
      const sA = salesmen.find(x => x.id === a);
      const sB = salesmen.find(x => x.id === b);
      if (!sA || !sB) return 0;
      if (individualTargetsSort === 'name') return sA.name.localeCompare(sB.name);
      return sA.code.localeCompare(sB.code);
    });

    const isEverbought = group.ubaMeasureType === 'Everbought';
    const hasMultiSubGroups = group.hasSubGroups && group.subGroups && Object.keys(group.subGroups).length > 0;
    const isGridView = hasMultiSubGroups && individualTargetsSubGroup === 'all';

    let targetsSetCount = 0;
    filteredParticipating.forEach(sId => {
      if (isGridView) {
        let hasTarget = false;
        Object.values(group.subGroups!).forEach((subG: any) => {
          const data = subG.individualTargets?.[sId];
          if (data !== undefined && data !== '' && data !== null) hasTarget = true;
        });
        if (hasTarget) targetsSetCount++;
      } else {
        const data = targets[sId];
        if (data !== undefined && data !== '' && data !== null) targetsSetCount++;
      }
    });

    return (
      <div style={{ display: 'flex', gap: '20px', height: '75vh' }}>
        {/* Left Sidebar Panel */}
        <div style={{ width: '290px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', overflowY: 'auto' }}>
          
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '4px' }}>
              Target Controls
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Configure filters, scope & template tools for <strong>{group.name}</strong>.
            </div>
          </div>

          {/* Target Scope / Month */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Target Scope / Month
            </label>
            <select 
              value={individualTargetsMonth}
              onChange={e => setIndividualTargetsMonth(e.target.value)}
              className="glass-panel"
              disabled={isEverbought}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', color: 'white', fontSize: '13px', opacity: isEverbought ? 0.7 : 1 }}
            >
              {isEverbought ? (
                <option value="">Flat Target (Everbought)</option>
              ) : (
                <>
                  {availableMonths.length === 0 && <option value="">Entire Program (Flat)</option>}
                  {availableMonths.length > 0 && <option value="">Flat Target (All Months)</option>}
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{new Date(`${m}-01`).toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Sub-Product Group Selector */}
          {hasMultiSubGroups && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Sub-Product Group
              </label>
              <select 
                value={individualTargetsSubGroup}
                onChange={e => setIndividualTargetsSubGroup(e.target.value)}
                className="glass-panel"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', color: 'white', fontSize: '13px' }}
              >
                <option value="all">All Sub-Product Groups ({Object.keys(group.subGroups!).length})</option>
                {Object.values(group.subGroups!).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name || `Sub-Group (${s.id})`}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search & Sort */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Search & Sort
            </label>
            <input 
              type="text" 
              placeholder="Search name or code..."
              value={individualTargetsSearch}
              onChange={e => setIndividualTargetsSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '12px' }}
            />
            <select 
              value={individualTargetsSort}
              onChange={e => setIndividualTargetsSort(e.target.value as any)}
              className="glass-panel"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}
            >
              <option value="name">Sort by Name</option>
              <option value="code">Sort by Code</option>
            </select>
          </div>

          {/* Branch Filter */}
          {availableBranches.length > 0 && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Branch Filter
              </label>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <button 
                  className="btn"
                  onClick={() => setIndividualTargetsBranches([])}
                  style={{ 
                    borderRadius: '12px', padding: '2px 8px', fontSize: '11px',
                    background: individualTargetsBranches.length === 0 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                    border: individualTargetsBranches.length === 0 ? 'none' : '1px solid var(--border)',
                    color: individualTargetsBranches.length === 0 ? 'white' : 'var(--text-muted)'
                  }}
                >
                  All
                </button>
                {availableBranches.map(b => (
                  <button 
                    key={b}
                    className="btn"
                    onClick={() => {
                      if (individualTargetsBranches.includes(b)) {
                        setIndividualTargetsBranches(individualTargetsBranches.filter(x => x !== b));
                      } else {
                        setIndividualTargetsBranches([...individualTargetsBranches, b]);
                      }
                    }}
                    style={{ 
                      borderRadius: '12px', padding: '2px 8px', fontSize: '11px',
                      background: individualTargetsBranches.includes(b) ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                      border: individualTargetsBranches.includes(b) ? 'none' : '1px solid var(--border)',
                      color: individualTargetsBranches.includes(b) ? 'white' : 'var(--text-muted)'
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Excel Data Tools */}
          <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Excel Data Tools
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => handleExportModalTargetTemplate(group, subGroup, individualTargetsMonth)}
              style={{ width: '100%', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              title="Export Excel template for this scope"
            >
              <FileSpreadsheet size={15} />
              <span>Export Template</span>
            </button>

            <label 
              className="btn"
              style={{ width: '100%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
              title="Upload Excel target file for this scope"
            >
              <Download size={15} style={{ transform: 'rotate(180deg)' }} />
              <span>Upload Targets</span>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={e => handleImportModalTargetFile(e, group.id, activeSubGroupId, individualTargetsMonth)} 
                style={{ display: 'none' }} 
              />
            </label>
          </div>

          {/* Footer Actions & Summary Card */}
          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="btn" 
              onClick={() => {
                if (isGridView) {
                  Object.keys(group.subGroups!).forEach(sId => {
                    handleUpdateSubGroup(group.id, sId, { individualTargets: {} });
                  });
                } else if (subGroup) {
                  handleUpdateSubGroup(group.id, subGroup.id, { individualTargets: {} });
                } else {
                  handleUpdateTrackingGroup(group.id, { individualTargets: {} });
                }
              }}
              style={{ width: '100%', color: 'var(--accent-danger)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', fontSize: '11px', borderRadius: '6px' }}
            >
              Clear All Targets
            </button>

            <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '10px 12px', borderRadius: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Salesmen Listed:</span>
                <strong style={{ color: 'white' }}>{filteredParticipating.length} / {participating.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Targets Configured:</span>
                <strong style={{ color: '#34d399' }}>{targetsSetCount} Salesmen</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '12px' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>
                {subGroup ? `${group.name} - ${subGroup.name}` : group.name}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                ({isGridView ? 'Multi Sub-Group Tabular Grid' : 'Individual Target Entry'})
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: group.targetType === 'STT' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: group.targetType === 'STT' ? '#60a5fa' : '#34d399' }}>
                Unit: {group.targetType === 'STT' ? 'PHP (₱)' : 'Cases (CS)'}
              </span>
            </div>
          </div>

          {/* Table / List View */}
          {participating.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 16px 0' }}>You must select <strong>Participating Salesmen</strong> at the bottom of the form before you can set individual targets.</p>
              <button className="btn btn-primary" onClick={() => setIndividualTargetsModal(null)}>Got it</button>
            </div>
          ) : isGridView ? (
            /* Tabular Grid View for All Sub-Product Groups */
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', minWidth: '180px', position: 'sticky', top: 0, background: '#0f172a', zIndex: 3 }}>Salesman</th>
                    {Object.values(group.subGroups!).map((s: any) => (
                      <th key={s.id} style={{ padding: '10px 14px', minWidth: '150px', position: 'sticky', top: 0, background: '#0f172a', zIndex: 2 }}>
                        <div style={{ fontWeight: 600, color: 'white' }}>{s.name || 'Sub-Group'}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>Target {group.targetType === 'STT' ? '(₱)' : '(CS)'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipating.map(salesmanId => {
                    const salesmanInfo = salesmen.find(s => s.id === salesmanId);
                    const name = salesmanInfo ? salesmanInfo.name : salesmanId;
                    const branch = salesmanInfo ? salesmanInfo.branch : '';

                    return (
                      <tr key={salesmanId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.7)', position: 'sticky', left: 0, zIndex: 1 }}>
                          <div style={{ fontWeight: 500, color: 'white' }}>{name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {salesmanId}{branch && branch !== 'Unassigned' ? ` • ${branch}` : ''}</div>
                        </td>
                        {Object.values(group.subGroups!).map((subG: any) => {
                          const subTargets = subG.individualTargets || {};
                          let currentTarget = '';
                          const data = subTargets[salesmanId];
                          if (individualTargetsMonth && !isEverbought) {
                            if (typeof data === 'object' && data !== null) {
                              currentTarget = data[individualTargetsMonth] !== undefined ? String(data[individualTargetsMonth]) : '';
                            }
                          } else {
                            if (typeof data === 'number') {
                              currentTarget = String(data);
                            } else if (typeof data === 'object' && data !== null && data['flat'] !== undefined) {
                              currentTarget = String(data['flat']);
                            }
                          }

                          return (
                            <td key={subG.id} style={{ padding: '8px 12px' }}>
                              <input 
                                type="number"
                                placeholder={individualTargetsMonth && !isEverbought ? `${new Date(`${individualTargetsMonth}-01`).toLocaleString('default', {month:'short'})}` : `Target`}
                                value={currentTarget}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newTargets = { ...subTargets } as Record<string, any>;

                                  if (individualTargetsMonth && !isEverbought) {
                                    const currentData = newTargets[salesmanId];
                                    const isObj = typeof currentData === 'object' && currentData !== null;
                                    const monthData = isObj ? { ...currentData } : {};

                                    if (val === '') {
                                      delete monthData[individualTargetsMonth];
                                      if (Object.keys(monthData).length === 0) delete newTargets[salesmanId];
                                      else newTargets[salesmanId] = monthData;
                                    } else {
                                      monthData[individualTargetsMonth] = Number(val);
                                      newTargets[salesmanId] = monthData;
                                    }
                                  } else {
                                    if (val === '') delete newTargets[salesmanId];
                                    else newTargets[salesmanId] = Number(val);
                                  }

                                  handleUpdateSubGroup(group.id, subG.id, { individualTargets: newTargets });
                                }}
                                style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontWeight: 600, fontSize: '13px' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Single Sub-Group or Group view */
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px' }}>
              {filteredParticipating.map(salesmanId => {
                const salesmanInfo = salesmen.find(s => s.id === salesmanId);
                const name = salesmanInfo ? salesmanInfo.name : salesmanId;
                const branch = salesmanInfo ? salesmanInfo.branch : '';
                
                let currentTarget = '';
                const data = targets[salesmanId];
                if (individualTargetsMonth && !isEverbought) {
                  if (typeof data === 'object' && data !== null) {
                    currentTarget = data[individualTargetsMonth] !== undefined ? String(data[individualTargetsMonth]) : '';
                  }
                } else {
                  if (typeof data === 'number') {
                    currentTarget = String(data);
                  } else if (typeof data === 'object' && data !== null && data['flat']) {
                     currentTarget = String(data['flat']);
                  }
                }

                return (
                  <div key={salesmanId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, color: 'white', fontSize: '14px' }}>{name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {salesmanId}{branch && branch !== 'Unassigned' ? ` • ${branch}` : ''}</span>
                    </div>
                    <div style={{ width: '180px' }}>
                      <input 
                        type="number" 
                        placeholder={individualTargetsMonth && !isEverbought ? `${new Date(`${individualTargetsMonth}-01`).toLocaleString('default', {month:'short'})} Target` : `Target ${group.targetType === 'STT' ? '(₱)' : '(CS)'}`}
                        value={currentTarget}
                        onChange={e => {
                          const val = e.target.value;
                          const newTargets = { ...targets } as Record<string, any>;
                          
                          if (individualTargetsMonth && !isEverbought) {
                            const currentData = newTargets[salesmanId];
                            const isObj = typeof currentData === 'object' && currentData !== null;
                            const monthData = isObj ? { ...currentData } : {};
                            
                            if (val === '') {
                              delete monthData[individualTargetsMonth];
                              if (Object.keys(monthData).length === 0) {
                                delete newTargets[salesmanId];
                              } else {
                                newTargets[salesmanId] = monthData;
                              }
                            } else {
                              monthData[individualTargetsMonth] = Number(val);
                              newTargets[salesmanId] = monthData;
                            }
                          } else {
                            if (val === '') {
                              delete newTargets[salesmanId];
                            } else {
                              newTargets[salesmanId] = Number(val);
                            }
                          }
                          
                          if (subGroup) {
                            handleUpdateSubGroup(group.id, subGroup.id, { individualTargets: newTargets });
                          } else {
                            handleUpdateTrackingGroup(group.id, { individualTargets: newTargets });
                          }
                        }}
                        style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontWeight: 600 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => { setIndividualTargetsModal(null); setIndividualTargetsSearch(''); setIndividualTargetsSubGroup('all'); }}
              style={{ padding: '10px 48px', borderRadius: '24px', boxShadow: '0 8px 16px rgba(59,130,246,0.3)', width: '220px' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ color: 'var(--accent-primary)', fontSize: '18px', margin: '0 0 8px 0' }}>Incentive Programs</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Create and manage special incentive programs, define custom tracking rules, and upload multi-month targets.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              type="button"
              className="btn"
              onClick={handleRecalculateAchievements}
              disabled={recalculating}
              style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Recalculate actual achievement values for all active incentive programs"
            >
              <RefreshCw size={16} className={recalculating ? "animate-spin" : ""} />
              <span>{recalculating ? 'Recalculating...' : 'Recalculate Achievements'}</span>
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Program
            </button>
          </div>
        </div>

        {programs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            No incentive programs found. Click 'New Program' to create one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 8px' }}>Title</th>
                <th style={{ padding: '12px 8px' }}>Duration</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {programs.map(prog => (
                <tr key={prog.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)' }}>{prog.title}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{prog.startMonth} to {prog.endMonth}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: prog.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: prog.status === 'active' ? '#4ade80' : 'var(--text-muted)' }}>
                      {prog.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        title="Edit"
                        onClick={() => handleEditProgram(prog)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', padding: '8px', color: '#60a5fa', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      
                      {prog.status === 'active' && (
                        <button 
                          title="Archive"
                          onClick={() => handleArchiveProgram(prog.id)}
                          style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '8px', color: '#fbbf24', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Archive size={16} />
                        </button>
                      )}

                      <button 
                        title="Delete"
                        onClick={() => handleDeleteProgram(prog.id)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '8px', color: '#f87171', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal 
        isOpen={showModal || !!individualTargetsModal} 
        onClose={() => { 
          if (individualTargetsModal) {
            setIndividualTargetsModal(null);
            setIndividualTargetsSearch('');
            setIndividualTargetsSubGroup('all');
          } else {
            setShowModal(false);
          }
        }} 
        maxWidth="1200px"
        title={individualTargetsModal ? (
          `Set Individual Targets${(() => {
            const [gId] = individualTargetsModal.split(':');
            const g = formData.trackingGroups?.[gId];
            if (!g) return '';
            const sub = (individualTargetsSubGroup !== 'all' && g.subGroups) ? g.subGroups[individualTargetsSubGroup] : undefined;
            return `: ${g.name || 'Group'}${sub ? ' - ' + sub.name : ''}`;
          })()}`
        ) : (
          formData.id ? "Edit Incentive Program" : "Create Incentive Program"
        )}
        headerRight={individualTargetsModal ? (
          <button
            type="button"
            onClick={() => {
              setIndividualTargetsModal(null);
              setIndividualTargetsSearch('');
              setIndividualTargetsSubGroup('all');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#60a5fa',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
              e.currentTarget.style.borderColor = '#60a5fa';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
            }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        ) : undefined}
        hideCloseButton={!!individualTargetsModal}
      >
        {individualTargetsModal ? renderIndividualTargetsContent() : (
          <div style={{ display: 'flex', gap: '20px', height: '75vh' }}>
          {/* Left Sidebar: Metadata & Actions */}
          <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(0,0,0,0.25)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)', overflowY: 'auto' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                Program Details
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Set basic program title, description, banner, and duration.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>Program Title</label>
              <input type="text" className="input" placeholder="e.g. Q3 Noodles Bonanza" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '13px' }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>Description</label>
              <textarea className="input" rows={3} placeholder="Describe the program..." value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', resize: 'vertical', fontSize: '13px' }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>Banner Image</label>
              {formData.bannerUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <div style={{ 
                    width: '100%', height: '100%', 
                    backgroundImage: `url(${formData.bannerUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }} />
                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px' }}>
                    <button 
                      type="button"
                      onClick={() => {
                        setLocalImageUrl(formData.bannerUrl!);
                        setPendingFile(null);
                        setShowCropper(true);
                      }}
                      style={{ background: 'rgba(15, 23, 42, 0.85)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', backdropFilter: 'blur(4px)' }}
                      title="Adjust Crop Settings"
                    >
                      <Crop size={13} /> Adjust Crops
                    </button>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, bannerUrl: '', cropSettings: undefined }))}
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', padding: '5px', cursor: 'pointer', display: 'flex' }}
                      title="Remove Image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <label 
                  style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                    width: '100%', height: '110px', border: '2px dashed var(--border)', borderRadius: '8px', 
                    cursor: uploadingImage ? 'not-allowed' : 'pointer', background: 'rgba(0,0,0,0.2)', transition: 'all 0.2s ease'
                  }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; }}
                  onDragLeave={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                    const file = e.dataTransfer.files[0];
                    if (file && !uploadingImage) handleImageUpload(file);
                  }}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file && !uploadingImage) handleImageUpload(file);
                    }}
                    disabled={uploadingImage}
                  />
                  {uploadingImage ? (
                    <>
                      <Loader2 size={20} color="var(--accent-primary)" className="animate-spin" style={{ marginBottom: '6px' }} />
                      <span style={{ color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600 }}>Compressing & Uploading...</span>
                    </>
                  ) : (
                    <>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '50%', marginBottom: '8px' }}>
                        <ImageIcon size={20} color="var(--text-muted)" />
                      </div>
                      <span style={{ color: 'var(--text-main)', fontSize: '12px', fontWeight: 500 }}>Click to upload banner</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>PNG, JPG or WEBP</span>
                    </>
                  )}
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>Start Month</label>
                <input type="month" className="input" value={formData.startMonth || ''} onChange={e => setFormData({...formData, startMonth: e.target.value})} style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '12px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>End Month</label>
                <input type="month" className="input" value={formData.endMonth || ''} onChange={e => setFormData({...formData, endMonth: e.target.value})} style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white', fontSize: '12px' }} />
              </div>
            </div>

            {/* Left Panel Action Buttons */}
            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '10px' }}>
              <button className="btn" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px' }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveProgram} disabled={saving} style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {saving ? 'Saving...' : <><Save size={16} /> Save Program</>}
              </button>
            </div>
          </div>

          {/* Right Main Panel: Tracking Groups & Participating Salesmen */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minWidth: 0, paddingRight: '4px' }}>
            
            {/* Tracking Groups Section */}
            <div style={{ padding: '18px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-primary)', margin: '0 0 4px 0', fontSize: '16px' }}>Tracking Groups</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Define tracking rules, sub-product groups, and target metrics.</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddTrackingGroup} style={{ padding: '8px 14px', fontSize: '13px' }}>
                  <Plus size={16} /> Add Tracking Group
                </button>
              </div>
              
              {Object.values(formData.trackingGroups || {}).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed var(--border)', fontSize: '13px' }}>
                  No tracking groups added yet. Click <strong>'+ Add Tracking Group'</strong> above to create your first tracking rule.
                </div>
              )}

              {Object.values(formData.trackingGroups || {}).map(group => (
                <div key={group.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '8px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                    <input type="text" placeholder="Group Name (e.g. Premium Noodles)" value={group.name} onChange={e => handleUpdateTrackingGroup(group.id, { name: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', marginRight: '12px', fontWeight: 600 }} />
                    <button 
                      onClick={() => handleDeleteTrackingGroup(group.id)} 
                      style={{ 
                        color: '#fca5a5', 
                        background: 'rgba(239, 68, 68, 0.15)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px', 
                        padding: '8px 12px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      title="Remove Group"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <select 
                      value={group.hasSubGroups ? 'sub_groups' : group.definitionType} 
                      onChange={e => {
                        const newType = e.target.value as any;
                        if (newType === 'sub_groups') {
                          handleUpdateTrackingGroup(group.id, {
                            hasSubGroups: true,
                            definitionType: 'products',
                            items: [],
                            subGroups: group.subGroups && Object.keys(group.subGroups).length > 0 ? group.subGroups : {
                              [`sub_${Date.now()}`]: { id: `sub_${Date.now()}`, name: 'Sub-product Group 1', items: [], individualTargets: {} }
                            }
                          });
                        } else {
                          handleUpdateTrackingGroup(group.id, { 
                            hasSubGroups: false,
                            definitionType: newType, 
                            items: [],
                            targetType: newType === 'new_customer' ? 'UBA' : group.targetType,
                            ubaMeasureType: newType === 'new_customer' ? 'Month-on-month' : group.ubaMeasureType
                          });
                        }
                      }}
                      className="glass-panel"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                    >
                      <option value="category">Track by Category</option>
                      <option value="products">Specific Products</option>
                      <option value="sub_groups">Sub-Product Groups (Multi-Level)</option>
                      <option value="new_customer">Track New Customers</option>
                    </select>
                    
                    <select 
                      value={group.targetType} 
                      onChange={e => handleUpdateTrackingGroup(group.id, { targetType: e.target.value as any, ubaMeasureType: e.target.value === 'UBA' || e.target.value === 'Mixed' ? 'Month-on-month' : undefined })}
                      className="glass-panel"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                      disabled={group.definitionType === 'new_customer'}
                    >
                      <option value="STT">STT (Net Value)</option>
                      <option value="UBA">UBA</option>
                    </select>
                    
                    {group.targetType === 'UBA' && (
                      <select 
                        value={group.ubaMeasureType || 'Month-on-month'} 
                        onChange={e => handleUpdateTrackingGroup(group.id, { ubaMeasureType: e.target.value as any })}
                        className="glass-panel"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
                      >
                        <option value="Month-on-month">Month-on-month UBA</option>
                        <option value="Everbought">Everbought UBA</option>
                      </select>
                    )}
                  </div>

                  {/* Target Row */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', width: '80px' }}>Target:</div>
                    <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                      <input 
                        type="number" 
                        placeholder={Object.keys(group.individualTargets || {}).length > 0 ? 'Individual Targets Set' : (group.definitionType === 'new_customer' ? 'Auto-Calculated from CML' : `Global Target ${group.targetType === 'STT' ? '(₱)' : ''}`)} 
                        value={group.targetValue || ''} 
                        onChange={e => handleUpdateTrackingGroup(group.id, { targetValue: Number(e.target.value) })} 
                        disabled={Object.keys(group.individualTargets || {}).length > 0}
                        style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', opacity: Object.keys(group.individualTargets || {}).length > 0 ? 0.5 : 1 }} 
                      />
                      <button
                        type="button"
                        className="btn"
                        title="Set Individual Targets per Salesman"
                        onClick={() => setIndividualTargetsModal(group.id)}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: Object.keys(group.individualTargets || {}).length > 0 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span style={{ fontSize: '13px' }}>{Object.keys(group.individualTargets || {}).length > 0 ? 'Edit Targets' : 'Per-Salesman'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Scope Selection Row: Products/Categories + Customer Channels */}
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    {!group.hasSubGroups && group.definitionType !== 'new_customer' && (
                      <button 
                        type="button"
                        className="btn" 
                        onClick={() => setSelectorModal({ groupId: group.id, type: group.definitionType === 'category' ? 'category' : 'product' })}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', justifyContent: 'flex-start', color: group.items.length > 0 ? 'white' : 'var(--text-muted)' }}
                      >
                        {group.items.length > 0 ? `${group.items.length} ${group.definitionType === 'category' ? 'Categories' : 'Products'} Selected` : `Select ${group.definitionType === 'category' ? 'Categories' : 'Products'}...`}
                      </button>
                    )}
                    
                    <button 
                      type="button"
                      className="btn" 
                      onClick={() => setSelectorModal({ groupId: group.id, type: 'channel' })}
                      style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', justifyContent: 'flex-start', color: (group.channels || []).length > 0 ? 'white' : 'var(--text-muted)' }}
                    >
                      {(group.channels || []).length > 0 ? `${group.channels!.length} Channels Selected` : 'All Channels (Default)'}
                    </button>
                  </div>

                  {group.definitionType === 'products' && group.targetType === 'UBA' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Minimum Drop Size (per customer per product)</label>
                      <input type="number" value={group.minDropSize || 0} onChange={e => handleUpdateTrackingGroup(group.id, { minDropSize: Number(e.target.value) })} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white' }} />
                    </div>
                  )}

                  {/* Sub-Product Groups Section */}
                  {group.hasSubGroups && (
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Sub-Product Groups ({Object.keys(group.subGroups || {}).length})</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Each sub-group tracks its assigned products</span>
                      </div>
                      {Object.values(group.subGroups || {}).map(sub => (
                        <div key={sub.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px', flexWrap: 'wrap' }}>
                          <input 
                            type="text" 
                            placeholder="Sub-Product Group Name (e.g. Sub-product Group 1.1)" 
                            value={sub.name} 
                            onChange={e => handleUpdateSubGroup(group.id, sub.id, { name: e.target.value })} 
                            style={{ flex: 1, minWidth: '160px', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', fontSize: '13px' }} 
                          />
                          <button 
                            type="button"
                            className="btn" 
                            onClick={() => setSelectorModal({ groupId: group.id, subGroupId: sub.id, type: 'product' })}
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', fontSize: '12px', color: sub.items.length > 0 ? 'white' : 'var(--text-muted)' }}
                          >
                            {sub.items.length > 0 ? `${sub.items.length} Products Selected` : 'Select Products...'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              setIndividualTargetsSubGroup(sub.id);
                              setIndividualTargetsModal(group.id);
                            }}
                            style={{ background: Object.keys(sub.individualTargets || {}).length > 0 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', fontSize: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Set Targets for this Sub-Product Group"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1 0 7.75"/></svg>
                            <span>{Object.keys(sub.individualTargets || {}).length > 0 ? 'Edit Targets' : 'Per-Salesman'}</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteSubGroup(group.id, sub.id)} 
                            style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title="Delete Sub-Group"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        className="btn" 
                        onClick={() => handleAddSubGroup(group.id)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px dashed var(--border)', marginTop: '4px', background: 'rgba(255,255,255,0.02)' }}
                      >
                        <Plus size={14} /> Add Sub-Product Group
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={group.overrideSalesmen || false}
                        onChange={e => handleUpdateTrackingGroup(group.id, { overrideSalesmen: e.target.checked, participatingSalesmen: e.target.checked ? (group.participatingSalesmen || salesmen.map(s => s.id)) : undefined })}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                      />
                      <span>Customize Salesmen Eligibility for this Group</span>
                    </label>
                    {group.overrideSalesmen && (
                      <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {salesmen.map(s => {
                          const isSel = (group.participatingSalesmen || []).includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleGroupSalesman(group.id, s.id)}
                              style={{
                                background: isSel ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isSel ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                                color: isSel ? '#60a5fa' : 'var(--text-muted)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <input 
                      type="checkbox" 
                      id={`daily-breakdown-${group.id}`}
                      checked={group.enableDailyBreakdown || false}
                      onChange={e => handleUpdateTrackingGroup(group.id, { enableDailyBreakdown: e.target.checked })}
                      style={{ cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                    />
                    <label htmlFor={`daily-breakdown-${group.id}`} style={{ fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
                      Enable Daily Breakdown on Export
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {/* Participating Salesmen Section */}
            <div style={{ padding: '18px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-success)', margin: '0 0 4px 0', fontSize: '16px' }}>Participating Salesmen</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Select the salesmen who are eligible for this program.</p>
                </div>
                <button 
                  className="btn" 
                  onClick={toggleAllSalesmen}
                  style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.05)' }}
                >
                  {(formData.participatingSalesmen || []).length === salesmen.length && salesmen.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <input 
                type="text" 
                placeholder="Search salesmen..." 
                value={salesmanSearch}
                onChange={e => setSalesmanSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', marginBottom: '14px', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {salesmen.filter(s => s.name.toLowerCase().includes(salesmanSearch.toLowerCase())).map(s => {
                  const isSelected = (formData.participatingSalesmen || []).includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSalesman(s.id)}
                      style={{
                        background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isSelected ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: isSelected ? '#10b981' : 'var(--text-main)',
                        padding: '8px 14px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                      {s.name}
                    </button>
                  );
                })}
                {salesmen.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading salesmen...</span>}
              </div>
            </div>
          </div>
        </div>
        )}
      </Modal>

      <Modal isOpen={!!selectorModal} onClose={() => { setSelectorModal(null); setSelectorSearch(''); setProductCategoryFilter('all'); }} title={`Select ${selectorModal?.type === 'category' ? 'Categories' : selectorModal?.type === 'channel' ? 'Channels' : 'Products'}`}>
        {selectorModal && (() => {
          const group = formData.trackingGroups?.[selectorModal.groupId];
          if (!group) return null;
          
          const isProd = selectorModal.type === 'product';
          const isSubGroup = !!selectorModal.subGroupId;
          const subGroup = isSubGroup ? group.subGroups?.[selectorModal.subGroupId!] : undefined;

          const options = selectorModal.type === 'category' ? categories : selectorModal.type === 'channel' ? channelsList : Object.keys(productMap);
          const selected = selectorModal.type === 'channel' 
            ? (group.channels || []) 
            : (isSubGroup ? (subGroup?.items || []) : group.items);
          
          const toggleSelection = (item: string) => {
            if (selectorModal.type === 'channel') {
              const newChannels = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
              handleUpdateTrackingGroup(group.id, { channels: newChannels });
            } else if (isSubGroup && selectorModal.subGroupId) {
              const newItems = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
              handleUpdateSubGroup(group.id, selectorModal.subGroupId, { items: newItems });
            } else {
              const newItems = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item];
              handleUpdateTrackingGroup(group.id, { items: newItems });
            }
          };

          const toggleAll = () => {
             if (isProd) return;
             if (selected.length === options.length) {
               if (selectorModal.type === 'category') handleUpdateTrackingGroup(group.id, { items: [] });
               else handleUpdateTrackingGroup(group.id, { channels: [] });
             } else {
               if (selectorModal.type === 'category') handleUpdateTrackingGroup(group.id, { items: options });
               else handleUpdateTrackingGroup(group.id, { channels: options });
             }
          };

          const filteredOptions = isProd 
            ? Object.entries(productMap).filter(([code, desc]) => {
                const matchesSearch = !selectorSearch || code.toLowerCase().includes(selectorSearch.toLowerCase()) || desc.toLowerCase().includes(selectorSearch.toLowerCase());
                const matchesCategory = productCategoryFilter === 'all' || productCategoryMap[code] === productCategoryFilter;
                return matchesSearch && matchesCategory;
              }).slice(0, 50).map(x => x[0])
            : options.filter(o => o.toLowerCase().includes(selectorSearch.toLowerCase()));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder={isProd ? "Search Item Code or Description..." : `Search or add custom ${selectorModal.type}...`}
                  value={selectorSearch}
                  onChange={e => setSelectorSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && selectorSearch.trim() && !isProd) {
                      const val = selectorSearch.trim();
                      if (selectorModal.type === 'category') {
                        if (!categories.includes(val)) setCategories(prev => [...prev, val].sort());
                        const newItems = selected.includes(val) ? selected : [...selected, val];
                        handleUpdateTrackingGroup(group.id, { items: newItems });
                      } else {
                        if (!channelsList.includes(val)) setChannelsList(prev => [...prev, val].sort());
                        const newChannels = selected.includes(val) ? selected : [...selected, val];
                        handleUpdateTrackingGroup(group.id, { channels: newChannels });
                      }
                      setSelectorSearch('');
                    }
                  }}
                  style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', minWidth: '150px' }}
                />
                {isProd && (
                  <select 
                    value={productCategoryFilter}
                    onChange={e => setProductCategoryFilter(e.target.value)}
                    className="glass-panel"
                    style={{ padding: '10px 12px', borderRadius: '6px', width: '180px' }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {!isProd && (
                  <button className="btn" onClick={toggleAll}>
                    {selected.length === options.length && options.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {isProd && selected.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', maxHeight: '100px', overflowY: 'auto' }}>
                  {selected.map(sel => (
                    <div key={sel} style={{ padding: '4px 8px', background: 'var(--accent-primary)', borderRadius: '4px', fontSize: '12px', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {sel}
                      <X size={12} style={{ cursor: 'pointer' }} onClick={() => toggleSelection(sel)} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px' }}>
                {filteredOptions.map(opt => {
                  const isSel = selected.includes(opt);
                  return (
                    <div 
                      key={opt}
                      onClick={() => toggleSelection(opt)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        background: isSel ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        transition: 'background 0.2s',
                        borderRadius: '4px'
                      }}
                    >
                      {isProd ? (
                        <>
                          <button className="btn" style={{ padding: '4px', background: isSel ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isSel ? 'var(--accent-danger)' : 'var(--accent-primary)', border: `1px solid ${isSel ? 'var(--accent-danger)' : 'var(--accent-primary)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSel ? <Minus size={14} /> : <Plus size={14} />}
                          </button>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'white' }}>{opt}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{productMap[opt] || ''}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: '20px', height: '20px', border: `2px solid ${isSel ? 'var(--accent-primary)' : 'var(--border)'}`, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? 'var(--accent-primary)' : 'transparent' }}>
                            {isSel && <Check size={14} color="white" strokeWidth={3} />}
                          </div>
                          <span style={{ color: isSel ? 'white' : 'var(--text-muted)', fontWeight: isSel ? 500 : 400 }}>{opt}</span>
                        </>
                      )}
                    </div>
                  );
                })}
                {filteredOptions.length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No options found. 
                    {selectorSearch ? (
                      <div style={{ marginTop: '8px', color: 'var(--accent-primary)', fontSize: '14px' }}>
                        {isProd ? `No products matching "${selectorSearch}"` : `Press Enter to add "${selectorSearch}" as a custom ${selectorModal.type}.`}
                      </div>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        {isProd ? 'Type to search for products...' : 'Type a name and press Enter to add a custom option.'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => { setSelectorModal(null); setSelectorSearch(''); }}
                  style={{ padding: '12px 40px', borderRadius: '30px', boxShadow: '0 8px 16px rgba(59,130,246,0.3)', width: '200px' }}
                >
                  Apply Selection
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {showCropper && (
        <ImageCropperModal
          isOpen={showCropper}
          onClose={() => {
            setShowCropper(false);
            setPendingFile(null);
            if (localImageUrl.startsWith('blob:')) {
              URL.revokeObjectURL(localImageUrl);
            }
            setLocalImageUrl('');
          }}
          imageUrl={localImageUrl}
          initialCrops={formData.cropSettings}
          onComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default IncentiveProgramMaker;
