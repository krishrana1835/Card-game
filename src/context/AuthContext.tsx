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
  deleteDoc,
  onSnapshot,
  collection,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
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
  switchAccount: (accountKey?: 'admin') => Promise<void>;
  loginWithCredentials: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsUser: (targetUser: UserProfile) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin Account credentials configured per user requirement
export const ADMIN_CREDENTIALS = {
  uid: 'admin_sofiamarshal77',
  email: 'sofiamarshal77@gmail.com',
  username: 'sofiamarshal77',
  displayName: 'Sofia Marshal (Admin)',
  password: 'Krish',
  role: 'admin' as const,
};

// Old dummy accounts that MUST be wiped out
const DUMMY_ACCOUNT_IDS = [
  'demo_player_alice',
  'demo_player_bob',
  'demo_player_charlie',
  'admin_krishrana1835',
];

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

      const isAdminEmail = u.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() || u.uid === ADMIN_CREDENTIALS.uid;
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

  // Real-time wallet and profile listeners
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

    setUnreadCount(0);

    return () => {
      unsubWallet();
      unsubUser();
    };
  }, [user]);

  // Setup admin account & wipe out any old dummy accounts from Firestore
  const setupAdminAndCleanDummies = async () => {
    try {
      // 1. Ensure admin account document exists in 'users'
      const adminDocRef = doc(db, 'users', ADMIN_CREDENTIALS.uid);
      const adminSnap = await getDoc(adminDocRef);
      if (!adminSnap.exists() || adminSnap.data()?.password !== ADMIN_CREDENTIALS.password) {
        await setDoc(
          adminDocRef,
          {
            id: ADMIN_CREDENTIALS.uid,
            username: 'Sofia Marshal',
            email: ADMIN_CREDENTIALS.email,
            emailVerified: true,
            role: 'admin',
            password: ADMIN_CREDENTIALS.password,
            accountStatus: 'active',
            startingGrantClaimed: true,
            gamesPlayed: 0,
            gamesWon: 0,
            loansRepaid: 0,
            totalRepaidAmount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // Also ensure in 'admins' collection for RBAC
      await setDoc(doc(db, 'admins', ADMIN_CREDENTIALS.uid), {
        email: ADMIN_CREDENTIALS.email,
        assignedAt: new Date().toISOString(),
      }, { merge: true });

      // Ensure admin wallet exists
      await getOrCreateWallet(ADMIN_CREDENTIALS.uid, 'Sofia Marshal');

      // 2. Remove all dummy accounts from Firestore (users & wallets)
      for (const dummyId of DUMMY_ACCOUNT_IDS) {
        try {
          await deleteDoc(doc(db, 'users', dummyId));
          await deleteDoc(doc(db, 'wallets', dummyId));
        } catch (e) {
          // ignore not found
        }
      }
    } catch (err) {
      console.warn('setupAdminAndCleanDummies warning:', err);
    }
  };

  // Auth state listener on boot
  useEffect(() => {
    // Run setup and cleanup in the background
    setupAdminAndCleanDummies();

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
        // Check if there is an active custom session saved in localStorage
        const savedSessionUid = localStorage.getItem('active_session_uid');

        // If saved session was pointing to a removed dummy account, remove it
        if (savedSessionUid && DUMMY_ACCOUNT_IDS.includes(savedSessionUid)) {
          localStorage.removeItem('active_session_uid');
          localStorage.removeItem('active_player_account');
          setUser(null);
          setLoading(false);
          return;
        }

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

        // NO automatic fallback to dummy accounts!
        // Show login page initially
        localStorage.removeItem('active_player_account');
        setUser(null);
        setProfile(null);
        setWallet(null);
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
   * Special support for Admin account sofiamarshal77@gmail.com with password Krish.
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

      // 1. Direct check for Admin account sofiamarshal77@gmail.com with password Krish
      const isAdminIdentifier =
        trimmedId === ADMIN_CREDENTIALS.email.toLowerCase() ||
        trimmedId === ADMIN_CREDENTIALS.username.toLowerCase() ||
        trimmedId === 'admin';

      if (isAdminIdentifier) {
        if (trimmedPass !== ADMIN_CREDENTIALS.password) {
          setLoading(false);
          return { success: false, error: 'Incorrect password for admin account.' };
        }

        // Setup admin profile & session
        const adminProfile: UserProfile = {
          id: ADMIN_CREDENTIALS.uid,
          username: 'Sofia Marshal',
          email: ADMIN_CREDENTIALS.email,
          emailVerified: true,
          role: 'admin',
          password: ADMIN_CREDENTIALS.password,
          accountStatus: 'active',
          startingGrantClaimed: true,
          gamesPlayed: 0,
          gamesWon: 0,
          loansRepaid: 0,
          totalRepaidAmount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Persist admin doc in Firestore if needed
        await setDoc(doc(db, 'users', ADMIN_CREDENTIALS.uid), adminProfile, { merge: true });
        const adminWallet = await getOrCreateWallet(ADMIN_CREDENTIALS.uid, 'Sofia Marshal');

        const active: ActiveUser = {
          uid: ADMIN_CREDENTIALS.uid,
          email: ADMIN_CREDENTIALS.email,
          displayName: 'Sofia Marshal (Admin)',
          isDemo: false,
        };

        localStorage.setItem('active_session_uid', ADMIN_CREDENTIALS.uid);
        localStorage.removeItem('active_player_account');

        setUser(active);
        setProfile(adminProfile);
        setWallet(adminWallet);
        setLoading(false);
        return { success: true };
      }

      // 2. Query users collection in Firestore for created accounts
      const usersSnap = await getDocs(collection(db, 'users'));
      const matchedDoc = usersSnap.docs.find((d) => {
        // Exclude old dummy accounts if any linger
        if (DUMMY_ACCOUNT_IDS.includes(d.id)) return false;
        const u = d.data() as UserProfile;
        const matchesName = u.username?.toLowerCase() === trimmedId;
        const matchesEmail = u.email?.toLowerCase() === trimmedId;
        const matchesId = d.id.toLowerCase() === trimmedId;
        return matchesName || matchesEmail || matchesId;
      });

      if (!matchedDoc) {
        setLoading(false);
        return { success: false, error: 'No account found with this username or email.' };
      }

      const userData = matchedDoc.data() as UserProfile;

      // Verify plain text password
      if (userData.password && userData.password !== trimmedPass) {
        setLoading(false);
        return { success: false, error: 'Incorrect password. Please try again.' };
      }

      // If user doc didn't have password stored yet, store it
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

  const switchAccount = async (accountKey?: 'admin') => {
    if (accountKey === 'admin') {
      await loginWithCredentials('sofiamarshal77@gmail.com', 'Krish');
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('active_session_uid');
      localStorage.removeItem('active_player_account');
      await fbSignOut(auth);
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      setProfile(null);
      setWallet(null);
    }
  };

  const isAdmin =
    profile?.role === 'admin' ||
    user?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() ||
    user?.uid === ADMIN_CREDENTIALS.uid;

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
