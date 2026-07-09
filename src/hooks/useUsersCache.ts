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

        const withTimeout = <T>(promise: Promise<T>, ms: number = 1000): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>(resolve => setTimeout(() => resolve(null), ms))
          ]);
        };

        // 2. Check local IDB for cached timestamp
        const localLastUpdate = await withTimeout(get('users_cache_timestamp')) || 0;
        const localUsers = await withTimeout(get('users_cache_data'));

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
        await withTimeout(set('users_cache_data', fetchedUsers));
        await withTimeout(set('users_cache_timestamp', Date.now()));

        if (mounted) {
          setUsersCache(fetchedUsers);
        }
      } catch (err: any) {
        if (err.code === 'permission-denied' || (err.message && err.message.includes('Missing or insufficient permissions'))) {
          // Expected for Salesmen, silently ignore
        } else {
          console.error("Error fetching users cache:", err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, []);

  return { usersCache, loading };
};
