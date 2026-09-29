import { get, set, keys, del, clear } from 'idb-keyval';

// Generic local draft management using IndexedDB

export type DraftType = 'manning' | 'picklist' | 'schedule' | 'ddrms' | 'deliveries' | 'collection';

export interface LocalDraft {
  id: string; // Unique draft ID (usually timestamp or temporary ID)
  type: DraftType;
  data: any;
  createdAt: string;
}

export const saveDraft = async (type: DraftType, data: any, customId?: string): Promise<string> => {
  const id = customId || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const draft: LocalDraft = {
    id,
    type,
    data,
    createdAt: new Date().toISOString()
  };
  await set(id, draft);
  return id;
};

export const getDraftsByType = async (type: DraftType): Promise<LocalDraft[]> => {
  const allKeys = await keys();
  const drafts: LocalDraft[] = [];
  
  for (const key of allKeys) {
    if (typeof key === 'string' && key.startsWith('draft_')) {
      const draft = await get<LocalDraft>(key);
      if (draft && draft.type === type) {
        drafts.push(draft);
      }
    }
  }
  
  // Sort by newest first
  return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getAllDrafts = async (): Promise<LocalDraft[]> => {
  const allKeys = await keys();
  const drafts: LocalDraft[] = [];
  
  for (const key of allKeys) {
    if (typeof key === 'string' && key.startsWith('draft_')) {
      const draft = await get<LocalDraft>(key);
      if (draft) {
        drafts.push(draft);
      }
    }
  }
  
  return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const deleteDraft = async (id: string): Promise<void> => {
  await del(id);
};

export const clearAllDrafts = async (): Promise<void> => {
  await clear();
};
