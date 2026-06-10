import { useState, useEffect } from 'react';
import { getDoc, getDocs, doc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { get, set } from 'idb-keyval';

export interface UserCacheData {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  role: string;
  salesmanId?: string;
  salesmanType?: string;
  team?: string;
  company_code?: string;
}

export const useUsersCache = () => {
  const [usersCache, setUsersCache] = useState<UserCacheData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        // 1. Check global settings for last user update
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        const serverLastUpdate = settingsSnap.data()?.lastUserUpdate || 0;

        // 2. Check local IDB for cached timestamp
        const localLastUpdate = await get('users_cache_timestamp') || 0;
        const localUsers = await get('users_cache_data');

        if (localUsers && localLastUpdate >= serverLastUpdate) {
          // Cache is valid
          if (mounted) {
            setUsersCache(localUsers);
            setLoading(false);
          }
          return;
        }

        // 3. Cache is invalid or missing, fetch from Firestore
        const snap = await getDocs(collection(db, 'users'));
        const fetchedUsers: UserCacheData[] = [];
        snap.forEach(d => {
          fetchedUsers.push({ uid: d.id, ...d.data() } as UserCacheData);
        });

        // 4. Save to IDB
        await set('users_cache_data', fetchedUsers);
        await set('users_cache_timestamp', Date.now());

        if (mounted) {
          setUsersCache(fetchedUsers);
          setLoading(false);
        }

      } catch (err) {
        console.error('Error fetching users cache:', err);
        if (mounted) setLoading(false);
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, []);

  return { usersCache, loading };
};
