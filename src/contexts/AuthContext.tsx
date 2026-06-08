import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'salesman' | null;

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  companyCode: string | null;
  name: string | null;
  photoURL: string | null;
  salesmanId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  role: null,
  companyCode: null,
  name: null,
  photoURL: null,
  salesmanId: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [companyCode, setCompanyCode] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [salesmanId, setSalesmanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          // First check Firestore users collection
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole((data.role as UserRole) || null);
            setCompanyCode(data.companyCode || null);
            setName(data.name || user.displayName || null);
            setPhotoURL(data.photoURL || user.photoURL || null);
            setSalesmanId(data.salesmanId || null);
          } else {
            // Fallback to custom claims
            const tokenResult = await user.getIdTokenResult();
            setRole((tokenResult.claims.role as UserRole) || null);
            setCompanyCode((tokenResult.claims.companyCode as string) || null);
            setName(user.displayName || null);
            setPhotoURL(user.photoURL || null);
            setSalesmanId(null);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setRole(null);
          setCompanyCode(null);
          setName(null);
          setPhotoURL(null);
          setSalesmanId(null);
        }
      } else {
        setRole(null);
        setCompanyCode(null);
        setName(null);
        setPhotoURL(null);
        setSalesmanId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, role, companyCode, name, photoURL, salesmanId, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
