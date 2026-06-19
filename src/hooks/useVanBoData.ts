import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';
import { useUsersCache } from './useUsersCache';
import { getPrice } from './usePricelist';
import type { PriceMap } from './usePricelist';


export interface VanBoItem {
  date: string;
  branch_name: string;
  van_code: string;
  salesman_code: string;
  category: string;
  product_code: string;
  product_description: string;
  uom: string;
  qty: number;
  amount: number;
}

export interface VanCard {
  van_code: string;
  salesman_code: string;
  salesman_name: string;
  totalQty: number;
  totalAmount: number;
}

export const useVanBoData = (priceMap: PriceMap, priceLoading: boolean = false) => {
  const { currentUser } = useAuth();
  const { usersCache, loading: usersLoading } = useUsersCache();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<VanBoItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [vans, setVans] = useState<VanCard[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [uploadDate, setUploadDate] = useState('');

  useEffect(() => {
    if (!currentUser || usersLoading || priceLoading) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastVanBoUpload = globalData?.lastVanBoUpload || 0;
        setUploadDate(globalData?.vanBoDate || '');

        const cacheKey = 'van_bo_cache_v2';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('van_bo_lastUpload_v2');

        let parsedItems: Omit<VanBoItem, 'amount'>[] = [];
        if (cachedData && cachedUpload === lastVanBoUpload) {
          parsedItems = cachedData;
        } else {
          const snap = await getDocs(collection(db, 'van_bo_data'));

          const formatExcelDate = (val: any) => {
            if (!val) return '';
            if (typeof val === 'number') {
              const d = new Date((val - 25569) * 86400 * 1000);
              return d.toISOString().split('T')[0];
            }
            return String(val);
          };

          const getValue = (r: any, keys: string[]) => {
            for (const k of keys) {
              if (r[k] !== undefined && r[k] !== null) return r[k];
            }
            const rowKeys = Object.keys(r);
            for (const k of keys) {
              const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === nk);
              if (match && r[match] !== undefined && r[match] !== null) return r[match];
            }
            return '';
          };

          const parseRow = (r: any): Omit<VanBoItem, 'amount'> => ({
            date: formatExcelDate(getValue(r, ['date', 'Date'])),
            branch_name: String(getValue(r, ['branch_name', 'Branch Name', 'Branch']) || ''),
            van_code: String(getValue(r, ['van_code', 'Van Code', 'Van']) || ''),
            salesman_code: String(getValue(r, ['salesman_code', 'Salesman Code', 'Salesman_Code']) || ''),
            category: String(getValue(r, ['category', 'Category']) || ''),
            product_code: String(getValue(r, ['product_code', 'Product Code']) || ''),
            product_description: String(getValue(r, ['product_description', 'Product Description', 'Description']) || ''),
            uom: String(getValue(r, ['UOM', 'uom']) || ''),
            qty: parseFloat(getValue(r, ['qty', 'Qty']) || 0)
          });

          snap.forEach(d => {
            const data = d.data();
            if (data.rows) {
              const chunk = JSON.parse(data.rows);
              chunk.forEach((r: any) => parsedItems.push(parseRow(r)));
            } else {
              parsedItems.push(parseRow(data));
            }
          });
          await set(cacheKey, parsedItems);
          await set('van_bo_lastUpload_v2', lastVanBoUpload);
        }

        // Apply pricelist to compute amount
        const withAmount: VanBoItem[] = parsedItems.map(item => ({
          ...item,
          amount: item.qty * getPrice(priceMap, item.product_code, item.uom)
        }));

        // Fetch user names for van card display
        const userNames2: Record<string, string> = {};
        usersCache.forEach(u => {
          if (u.salesmanId && u.name) userNames2[String(u.salesmanId)] = u.name;
        });

        const total = withAmount.reduce((sum, i) => sum + i.qty, 0);
        const totalAmt = withAmount.reduce((sum, i) => sum + i.amount, 0);
        const cats = Array.from(new Set(withAmount.map(i => i.category).filter(Boolean))).sort();

        // Build van cards
        const vanMap: Record<string, { salesman_code: string; totalQty: number; totalAmount: number }> = {};
        withAmount.forEach(item => {
          if (!item.van_code) return;
          if (!vanMap[item.van_code]) {
            vanMap[item.van_code] = { salesman_code: item.salesman_code, totalQty: 0, totalAmount: 0 };
          }
          vanMap[item.van_code].totalQty += item.qty;
          vanMap[item.van_code].totalAmount += item.amount;
        });
        const vanList: VanCard[] = Object.keys(vanMap).map(code => ({
          van_code: code,
          salesman_code: vanMap[code].salesman_code,
          salesman_name: userNames2[vanMap[code].salesman_code] || vanMap[code].salesman_code,
          totalQty: vanMap[code].totalQty,
          totalAmount: vanMap[code].totalAmount
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        setItems(withAmount);
        setCategories(cats);
        setVans(vanList);
        setTotalQty(total);
        setTotalAmount(totalAmt);
      } catch (err) {
        console.error('Error fetching Van BO data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, usersLoading, priceMap, priceLoading]);

  return { loading, items, categories, vans, totalQty, totalAmount, uploadDate };
};
