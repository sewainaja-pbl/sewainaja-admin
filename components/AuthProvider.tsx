'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Force refresh token to get latest custom claims
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          
          // Check for 'admin' custom claim (Source of Truth for Security Rules)
          if (idTokenResult.claims.admin === true) {
            setUser(firebaseUser);
            setIsAdmin(true);
          } else {
            // Fallback to Firestore check if claims are not set yet (legacy or slow propagation)
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists() && userDoc.data().isAdmin === true) {
              setUser(firebaseUser);
              setIsAdmin(true);
            } else {
              console.warn('Unauthorized: No admin claim or Firestore flag found.');
              await signOut(auth);
              setUser(null);
              setIsAdmin(false);
            }
          }
        } catch (error) {
          console.error('Security: Error during authentication check:', error);
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
