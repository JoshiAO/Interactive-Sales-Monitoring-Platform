import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './config';

export const login = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const logout = async () => {
  return await signOut(auth);
};
