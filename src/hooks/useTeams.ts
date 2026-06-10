import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export const useTeams = () => {
  const { role } = useAuth();
  const [teams, setTeams] = useState<string[]>([]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'manager') return;

    const fetchTeams = async () => {
      try {
        const snap = await getDoc(doc(db, 'reference_team_service', 'all'));
        const uniqueTeams = new Set<string>();
        if (snap.exists()) {
          const data = snap.data();
          Object.values(data).forEach((d: any) => {
            if (d.team) uniqueTeams.add(d.team);
          });
        }
        setTeams(Array.from(uniqueTeams).sort());
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };
    fetchTeams();
  }, [role]);

  return teams;
};
