import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { get, set } from 'idb-keyval';
import { useAuth } from '../contexts/AuthContext';

export interface ProductAdsMap {
  [product_code: string]: {
    description: string;
    ads: number;
    branchAds: Record<string, number>;
  };
}

export const useProductAds = () => {
  const { currentUser } = useAuth();
  const [adsMap, setAdsMap] = useState<ProductAdsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchAds = async () => {
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastUpload = globalData?.lastReferenceUpload || 0;

        const cacheKey = 'reference_ads_cache';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('ads_lastUpload');

        if (cachedData && cachedUpload === lastUpload) {
          setAdsMap(cachedData);
          setLoading(false);
          return;
        }

        const docRef = doc(db, 'reference_ads', 'all');
        const docSnap = await getDoc(docRef);
        
        let newMap: ProductAdsMap = {};
        if (docSnap.exists()) {
          const rawData = docSnap.data().data;
          if (rawData) {
            const parsed: Record<string, [string, number | Record<string, number>]> = JSON.parse(rawData);
            Object.keys(parsed).forEach(key => {
              const val = parsed[key][1];
              let branchAds: Record<string, number> = {};
              let legacyAds = 0;
              
              if (typeof val === 'number') {
                legacyAds = val;
              } else if (typeof val === 'object' && val !== null) {
                branchAds = val as Record<string, number>;
              }

              newMap[key] = {
                description: parsed[key][0],
                ads: legacyAds,
                branchAds: branchAds
              };
            });
          } else {
            // Fallback for old data format
            const data = docSnap.data();
            Object.keys(data).forEach(k => {
              if (k !== 'data' && data[k] && typeof data[k] === 'object') {
                const oldEntry = data[k] as { description: string; ads: number };
                newMap[k] = { ...oldEntry, branchAds: {} };
              }
            });
          }
        }

        await set(cacheKey, newMap);
        await set('ads_lastUpload', lastUpload);
        setAdsMap(newMap);
      } catch (error) {
        console.error("Error fetching Product ADS reference:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, [currentUser]);

  return { adsMap, loading };
};
