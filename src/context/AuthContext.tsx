import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Wallet } from '../types';
import { getOrCreateWallet } from '../services/ledgerService';

export interface ActiveUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isDemo?: boolean;
}

interface AuthContextType {
  user: ActiveUser | null;
  profile: UserProfile | null;
  wallet: Wallet | null;
  unreadCount: number;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  switchAccount: (accountKey: 'admin' | 'alice' | 'bob' | 'charlie') => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsUser: (targetUser: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PRESET_ACCOUNTS = {
  admin: {
    uid: 'admin_krishrana1835',
    email: 'krishrana1835@gmail.com',
    displayName: 'Krish Rana (Admin)',
    role: 'admin' as const,
  },
  alice: {
    uid: 'demo_player_alice',
    email: 'alice.player@teenpatti.app',
    displayName: 'Alice (Player 1)',
    role: 'player' as const,
  },
  bob: {
    uid: 'demo_player_bob',
    email: 'bob.player@teenpatti.app',
    displayName: 'Bob (Player 2)',
    role: 'player' as const,
  },
  charlie: {
    uid: 'demo_player_charlie',
    email: 'charlie.player@teenpatti.app',
    displayName: 'Charlie (Player 3)',
    role: 'player' as const,
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ActiveUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync profile & wallet in Firestore
  const syncUserData = async (u: ActiveUser, roleOverride?: 'player' | 'admin') => {
    try {
      const userDocRef = doc(db, 'users', u.uid);
      const userSnap = await getDoc(userDocRef);

      const isAdminEmail = u.email === 'krishrana1835@gmail.com';
      const role = roleOverride || (isAdminEmail ? 'admin' : 'player');

      let currentProfile: UserProfile;
      if (!userSnap.exists()) {
        currentProfile = {
          id: u.uid,
          username: u.displayName || u.email?.split('@')[0] || 'Player',
          email: u.email || 'guest@virtualbank.app',
          emailVerified: true,
          role,
          accountStatus: 'active',
          startingGrantClaimed: true,
          gamesPlayed: 0,
          gamesWon: 0,
          loansRepaid: 0,
          totalRepaidAmount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, currentProfile);
      } else {
        currentProfile = userSnap.data() as UserProfile;
        if (isAdminEmail && currentProfile.role !== 'admin') {
          currentProfile.role = 'admin';
          await setDoc(userDocRef, { role: 'admin' }, { merge: true });
        }
      }

      setProfile(currentProfile);

      // Ensure wallet exists
      const userWallet = await getOrCreateWallet(u.uid, currentProfile.username);
      setWallet(userWallet);
    } catch (err) {
      console.error('Error syncing user data: ', err);
    }
  };

  // Real-time wallet listener
  useEffect(() => {
    if (!user) {
      setWallet(null);
      setProfile(null);
      return;
    }

    const walletRef = doc(db, 'wallets', user.uid);
    const unsubWallet = onSnapshot(
      walletRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setWallet(docSnap.data() as Wallet);
        }
      },
      (error) => {
        console.warn(`Wallet listener warning for ${user.uid}:`, error);
      }
    );

    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      },
      (error) => {
        console.warn(`User profile listener warning for ${user.uid}:`, error);
      }
    );

    // No real-time notifications listener needed as requested
    setUnreadCount(0);

    return () => {
      unsubWallet();
      unsubUser();
    };
  }, [user]);

  // Auth state listener on boot
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const active: ActiveUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Player',
          isDemo: false,
        };
        setUser(active);
        await syncUserData(active);
        setLoading(false);
      } else {
        // Check if there is a saved logged-in custom user session
        const savedSessionUid = localStorage.getItem('active_session_uid');
        if (savedSessionUid) {
          try {
            const userDocRef = doc(db, 'users', savedSessionUid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const u = userSnap.data() as UserProfile;
              const active: ActiveUser = {
                uid: u.id,
                email: u.email,
                displayName: u.username,
                isDemo: false,
              };
              setUser(active);
              setProfile(u);
              const userWallet = await getOrCreateWallet(u.id, u.username);
              setWallet(userWallet);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Error restoring saved session:', e);
          }
        }

        // Fallback to saved preset account from localStorage
        const savedAccount = localStorage.getItem('active_player_account') as 'admin' | 'alice' | 'bob' | 'charlie' | null;
        const targetPreset = PRESET_ACCOUNTS[savedAccount || 'admin'];
        const active: ActiveUser = {
          uid: targetPreset.uid,
          email: targetPreset.email,
          displayName: targetPreset.displayName,
          isDemo: true,
        };
        setUser(active);
        await syncUserData(active, targetPreset.role);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleProvider);
      const active: ActiveUser = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        isDemo: false,
      };
      localStorage.removeItem('active_session_uid');
      localStorage.removeItem('active_player_account');
      setUser(active);
      await syncUserData(active);
    } catch (err) {
      console.error('Google Sign In Error: ', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log in with username or email and plain text password.
   */
  const loginWithCredentials = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const trimmedId = identifier.trim().toLowerCase();
      const trimmedPass = password.trim();

      if (!trimmedId || !trimmedPass) {
        setLoading(false);
        return { success: false, error: 'Please enter both username/email and password.' };
      }

      // Query users collection in Firestore
      const usersSnap = await getDocs(collection(db, 'users'));
      const matchedDoc = usersSnap.docs.find((d) => {
        const u = d.data() as UserProfile;
        const matchesName = u.username?.toLowerCase() === trimmedId;
        const matchesEmail = u.email?.toLowerCase() === trimmedId;
        const matchesId = d.id.toLowerCase() === trimmedId;
        return matchesName || matchesEmail || matchesId;
      });

      if (!matchedDoc) {
        // Also check if admin or preset player is being logged into with default game password
        const isPresetAdmin = trimmedId === 'admin' || trimmedId === 'krishrana1835@gmail.com';
        if (isPresetAdmin && (trimmedPass === 'admin' || trimmedPass === 'admin123' || trimmedPass === 'password')) {
          await switchAccount('admin');
          return { success: true };
        }
        setLoading(false);
        return { success: false, error: 'No user found with this username or email.' };
      }

      const userData = matchedDoc.data() as UserProfile;

      // Verify plain text password
      // If user doc doesn't have password stored yet (e.g. preset accounts), accept and set it
      if (userData.password && userData.password !== trimmedPass) {
        setLoading(false);
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      // If user doc didn't have password, record it
      if (!userData.password) {
        await setDoc(doc(db, 'users', matchedDoc.id), { password: trimmedPass }, { merge: true });
        userData.password = trimmedPass;
      }

      const active: ActiveUser = {
        uid: matchedDoc.id,
        email: userData.email,
        displayName: userData.username,
        isDemo: false,
      };

      localStorage.setItem('active_session_uid', matchedDoc.id);
      localStorage.removeItem('active_player_account');

      setUser(active);
      setProfile(userData);

      const userWallet = await getOrCreateWallet(matchedDoc.id, userData.username);
      setWallet(userWallet);
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Error logging in with credentials:', err);
      setLoading(false);
      return { success: false, error: err.message || 'Login failed. Please try again.' };
    }
  };

  /**
   * Log in directly as a user profile (e.g. from Admin user table).
   */
  const loginAsUser = async (targetUser: UserProfile) => {
    setLoading(true);
    const active: ActiveUser = {
      uid: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.username,
      isDemo: false,
    };
    localStorage.setItem('active_session_uid', targetUser.id);
    localStorage.removeItem('active_player_account');

    setUser(active);
    setProfile(targetUser);

    const userWallet = await getOrCreateWallet(targetUser.id, targetUser.username);
    setWallet(userWallet);
    setLoading(false);
  };

  const switchAccount = async (accountKey: 'admin' | 'alice' | 'bob' | 'charlie') => {
    setLoading(true);
    localStorage.removeItem('active_session_uid');
    localStorage.setItem('active_player_account', accountKey);
    const preset = PRESET_ACCOUNTS[accountKey];
    const active: ActiveUser = {
      uid: preset.uid,
      email: preset.email,
      displayName: preset.displayName,
      isDemo: true,
    };
    setUser(active);
    await syncUserData(active, preset.role);
    setLoading(false);
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('active_session_uid');
      localStorage.removeItem('active_player_account');
      await fbSignOut(auth);
      // switch to alice or default
      await switchAccount('alice');
    } catch (err) {
      console.error(err);
    }
  };

  const isAdmin = profile?.role === 'admin' || user?.email === 'krishrana1835@gmail.com';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        wallet,
        unreadCount,
        isAdmin,
        loading,
        signInWithGoogle,
        signOut,
        switchAccount,
        loginWithCredentials,
        loginAsUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
