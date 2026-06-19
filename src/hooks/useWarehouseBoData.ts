import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';
import { getPrice } from './usePricelist';
import type { PriceMap } from './usePricelist';


export interface WarehouseBoItem {
  date: string;
  branch_name: string;
  category: string;
  product_code: string;
  product_description: string;
  uom: string;
  qty: number;
  srs_reference: string;
  amount: number;
}

export const useWarehouseBoData = (priceMap: PriceMap, priceLoading: boolean = false) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<WarehouseBoItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [uploadDate, setUploadDate] = useState('');

  useEffect(() => {
    if (!currentUser || priceLoading) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastWarehouseBoUpload = globalData?.lastWarehouseBoUpload || 0;
        setUploadDate(globalData?.warehouseBoDate || '');

        const cacheKey = 'warehouse_bo_cache_v2';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('warehouse_bo_lastUpload_v2');

        let parsedItems: Omit<WarehouseBoItem, 'amount'>[] = [];
        if (cachedData && cachedUpload === lastWarehouseBoUpload) {
          parsedItems = cachedData;
        } else {
          const snap = await getDocs(collection(db, 'warehouse_bo_data'));

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

          const parseRow = (r: any): Omit<WarehouseBoItem, 'amount'> => ({
            date: formatExcelDate(getValue(r, ['date', 'Date'])),
            branch_name: String(getValue(r, ['branch_name', 'Branch Name', 'Branch']) || ''),
            category: String(getValue(r, ['category', 'Category']) || ''),
            product_code: String(getValue(r, ['product_code', 'Product Code']) || ''),
            product_description: String(getValue(r, ['product_description', 'Product Description', 'Description']) || ''),
            uom: String(getValue(r, ['UOM', 'uom']) || ''),
            qty: parseFloat(getValue(r, ['qty', 'Qty']) || 0),
            srs_reference: String(getValue(r, ['srs_reference', 'SRS Reference', 'SRS No.']) || '')
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
          await set('warehouse_bo_lastUpload_v2', lastWarehouseBoUpload);
        }

        // Apply pricelist to compute amount
        const withAmount: WarehouseBoItem[] = parsedItems.map(item => ({
          ...item,
          amount: item.qty * getPrice(priceMap, item.product_code, item.uom)
        }));

        const total = withAmount.reduce((sum, i) => sum + i.qty, 0);
        const totalAmt = withAmount.reduce((sum, i) => sum + i.amount, 0);
        const cats = Array.from(new Set(withAmount.map(i => i.category).filter(Boolean))).sort();
        const brs = Array.from(new Set(withAmount.map(i => i.branch_name).filter(Boolean))).sort();

        setItems(withAmount);
        setCategories(cats);
        setBranches(brs);
        setTotalQty(total);
        setTotalAmount(totalAmt);
      } catch (err) {
        console.error('Error fetching Warehouse BO data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, priceMap, priceLoading]);

  return { loading, items, categories, branches, totalQty, totalAmount, uploadDate };
};
