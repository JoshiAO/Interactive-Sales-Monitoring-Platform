import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { get, set } from 'idb-keyval';
import { useAuth } from '../contexts/AuthContext';

export const useItemCategories = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [descriptionMap, setDescriptionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastUpload = globalData?.lastReferenceUpload || 0;

        const cacheKey = 'item_masterlist_cache_v1';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('item_masterlist_lastUpload');

        if (cachedData && cachedUpload === lastUpload) {
          setCategoryMap(cachedData.categoryMap);
          setDescriptionMap(cachedData.descriptionMap);
          setLoading(false);
          return;
        }

        const docSnap = await getDoc(doc(db, 'reference_masterlist', 'all'));
        const catMap: Record<string, string> = {};
        const descMap: Record<string, string> = {};

        if (docSnap.exists()) {
          const rawData = docSnap.data().data;
          if (rawData) {
            const parsed: Record<string, [string, string]> = JSON.parse(rawData);
            Object.keys(parsed).forEach(key => {
              descMap[key] = parsed[key][0];
              catMap[key] = parsed[key][1];
            });
          }
        }

        const combinedData = { categoryMap: catMap, descriptionMap: descMap };
        await set(cacheKey, combinedData);
        await set('item_masterlist_lastUpload', lastUpload);
        
        setCategoryMap(catMap);
        setDescriptionMap(descMap);
      } catch (err) {
        console.error('Error fetching Item Masterlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  return { loading, categoryMap, descriptionMap };
};
