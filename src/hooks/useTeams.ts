import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export const useTeams = () => {
  const { role } = useAuth();
  const [teams, setTeams] = useState<string[]>([]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'manager') return;

    const fetchTeams = async () => {
      try {
        const snap = await getDocs(collection(db, 'reference_team_service'));
        const uniqueTeams = new Set<string>();
        snap.forEach(d => {
          const t = d.data().team;
          if (t) uniqueTeams.add(t);
        });
        setTeams(Array.from(uniqueTeams).sort());
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    fetchTeams();
  }, [role]);

  return teams;
};
