import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export const useCompanyAttributes = () => {
  const { companyCode } = useAuth();
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyCode) {
      setLoading(false);
      return;
    }

    const fetchAttributes = async () => {
      try {
        const docRef = doc(db, 'company_attributes', companyCode);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.branch && Array.isArray(data.branch)) {
            setBranches(data.branch);
          } else if (data.branch && typeof data.branch === 'string') {
            setBranches([data.branch]);
          } else {
             setBranches([]);
          }
        } else {
          setBranches([]);
        }
      } catch (error) {
        console.error("Error fetching company attributes:", error);
        setBranches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, [companyCode]);

  return { branches, loading };
};
