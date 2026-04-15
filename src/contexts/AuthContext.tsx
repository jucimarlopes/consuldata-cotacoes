import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'admin' | 'uploader' | 'viewer';

interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<void>;
  register: (e: string, p: string, n: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) setLoading(true);
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const email = firebaseUser.email || '';
          const isDomain = email.endsWith('@consuldata.com.br') || email.endsWith('@consuldatac.com.br');
          const isAdminEmail = 
            email === 'gestao.junior.lopes@gmail.com' || 
            email === 'jucimar.lopes@consuldata.com.br' || 
            email === 'jucimar.lopes@consuldatac.com.br' || 
            email === 'compras@consuldata.com.br';
          
          if (!isDomain && !isAdminEmail) {
            await signOut(auth);
            alert('Acesso negado. Apenas e-mails autorizados da ConsulData são permitidos.');
            setAppUser(null);
            setLoading(false);
            return;
          }

          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            setAppUser(userSnap.data() as AppUser);
          } else {
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: email,
              name: firebaseUser.displayName || email.split('@')[0],
              role: isAdminEmail ? 'admin' : 'viewer',
            };
            await setDoc(userRef, {
              ...newUser,
              createdAt: serverTimestamp(),
            });
            setAppUser(newUser);
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string, name: string) => {
    await createUserWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
