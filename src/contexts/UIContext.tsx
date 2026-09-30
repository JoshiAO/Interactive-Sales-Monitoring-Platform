import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { DEFAULT_PAGES, type PageSetting } from '../pages/admin/UISettingsTab';

interface UIContextType {
  pages: PageSetting[];
  loading: boolean;
  canAccess: (pageId: string, role: string, isMenuCheck?: boolean) => boolean;
  canEditPage: (pageId: string, role: string) => boolean;
}

const UIContext = createContext<UIContextType>({
  pages: DEFAULT_PAGES,
  loading: true,
  canAccess: () => true,
  canEditPage: () => false
});

export const useUI = () => useContext(UIContext);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pages, setPages] = useState<PageSetting[]>(DEFAULT_PAGES);
  const [loading, setLoading] = useState(true);

  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setPages(DEFAULT_PAGES);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'settings', 'ui'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().pages) {
        const dbPages = docSnap.data().pages as PageSetting[];
        const merged = DEFAULT_PAGES.map(dp => {
          const found = dbPages.find(p => p.id === dp.id);
          return found ? { ...dp, ...found } : dp;
        });
        setPages(merged);
      } else {
        setPages(DEFAULT_PAGES);
      }
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch UI settings", error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const canAccess = (pageId: string, role: string, _isMenuCheck = false) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return true; // Default allow if not managed by settings

    const normalizedRole = (role || '').toLowerCase();

    // Removed global visibility block for menu so users can see disabled pages as previews

    // Check Role access
    const roleAccess = page.roles[normalizedRole];
    if (!roleAccess) return false;
    
    return roleAccess.read;
  };

  const canEditPage = (pageId: string, role: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return role.toLowerCase() === 'admin'; // Default edit to admin only if not in settings

    const normalizedRole = (role || '').toLowerCase();
    const roleAccess = page.roles[normalizedRole];
    if (!roleAccess) return false;
    
    return roleAccess.edit;
  };

  return (
    <UIContext.Provider value={{ pages, loading, canAccess, canEditPage }}>
      {children}
    </UIContext.Provider>
  );
};
