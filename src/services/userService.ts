import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Wallet, LedgerEntry } from '../types';

export interface CreateUserData {
  username: string;
  email?: string;
  password: string;
  role?: 'player' | 'admin';
  initialBalance?: number;
}

/**
 * Creates a game user in Firestore with plain text password and initial wallet balance.
 * No hash or salt as requested ("no need to create hash or add more security something because it's just game").
 */
export async function createGameUser(
  data: CreateUserData,
  adminEmail: string = 'admin'
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const trimmedUsername = data.username.trim();
    const trimmedPassword = data.password.trim();

    if (!trimmedUsername) {
      return { success: false, error: 'Username is required' };
    }
    if (!trimmedPassword) {
      return { success: false, error: 'Password is required' };
    }

    const trimmedEmail = data.email?.trim() || `${trimmedUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@game.local`;
    const initialMoney = data.initialBalance ?? 10000000; // default 10,000,000 Rs
    const role = data.role || 'player';

    // Check if user with same username or email already exists
    const usersSnap = await getDocs(collection(db, 'users'));
    const existing = usersSnap.docs.find((d) => {
      const u = d.data() as UserProfile;
      return (
        u.username?.toLowerCase() === trimmedUsername.toLowerCase() ||
        u.email?.toLowerCase() === trimmedEmail.toLowerCase()
      );
    });

    if (existing) {
      return {
        success: false,
        error: `User with username "${trimmedUsername}" or email "${trimmedEmail}" already exists.`,
      };
    }

    // Generate clean user ID
    const sanitizedName = trimmedUsername.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const userId = `player_${sanitizedName}_${Date.now().toString().slice(-4)}`;

    const newProfile: UserProfile = {
      id: userId,
      username: trimmedUsername,
      email: trimmedEmail,
      emailVerified: true,
      role,
      password: trimmedPassword, // Plain text password stored for the game
      accountStatus: 'active',
      startingGrantClaimed: true,
      gamesPlayed: 0,
      gamesWon: 0,
      loansRepaid: 0,
      totalRepaidAmount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save user profile
    await setDoc(doc(db, 'users', userId), newProfile);

    // Initialize wallet with starting money
    const initialWallet: Wallet = {
      userId,
      username: trimmedUsername,
      availableBalance: initialMoney,
      lockedInGames: 0,
      reservedInLoans: 0,
      outstandingBankDebt: 0,
      outstandingPrivateDebt: 0,
      totalBalance: initialMoney,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'wallets', userId), initialWallet);

    // Record initial starting grant in ledger
    const grantEntries: LedgerEntry[] = [
      {
        accountType: 'bank_reserves',
        side: 'debit',
        amount: initialMoney,
        notes: `Admin provisioned Rs ${initialMoney.toLocaleString()} grant for ${trimmedUsername}`,
      },
      {
        accountType: 'player_wallet',
        side: 'credit',
        amount: initialMoney,
        ownerId: userId,
        notes: `Initial game capital credited`,
      },
    ];

    await addDoc(collection(db, 'ledger_transactions'), {
      transactionType: 'grant',
      initiatorId: 'admin',
      recipientId: userId,
      amount: initialMoney,
      status: 'completed',
      description: `Admin initial money allocation for ${trimmedUsername}`,
      entries: grantEntries,
      createdAt: new Date().toISOString(),
    });

    // Record admin audit log
    await addDoc(collection(db, 'audit_logs'), {
      action: 'ADMIN_CREATED_USER',
      performedBy: adminEmail,
      performedByEmail: adminEmail,
      details: {
        userId,
        username: trimmedUsername,
        email: trimmedEmail,
        role,
        initialBalance: initialMoney,
      },
      createdAt: new Date().toISOString(),
    });

    return { success: true, user: newProfile };
  } catch (error: any) {
    console.error('Error creating user: ', error);
    return { success: false, error: error.message || 'Failed to create user' };
  }
}

/**
 * Updates a user's password directly in Firestore.
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string,
  adminEmail: string = 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed) {
      return { success: false, error: 'Password cannot be empty' };
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      password: trimmed,
      updatedAt: new Date().toISOString(),
    });

    // Record audit log
    await addDoc(collection(db, 'audit_logs'), {
      action: 'ADMIN_UPDATED_PASSWORD',
      performedBy: adminEmail,
      performedByEmail: adminEmail,
      details: { userId },
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating password:', error);
    return { success: false, error: error.message || 'Failed to update password' };
  }
}

/**
 * Adjusts a user's wallet balance (admin grant or correction).
 */
export async function adjustUserBalance(
  userId: string,
  username: string,
  amount: number,
  adminEmail: string = 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const walletRef = doc(db, 'wallets', userId);
    const snap = await getDoc(walletRef);
    if (!snap.exists()) {
      return { success: false, error: 'Wallet not found' };
    }

    const currentWallet = snap.data() as Wallet;
    const newAvailable = Math.max(0, currentWallet.availableBalance + amount);
    const newTotal = Math.max(0, currentWallet.totalBalance + amount);

    await updateDoc(walletRef, {
      availableBalance: newAvailable,
      totalBalance: newTotal,
      updatedAt: new Date().toISOString(),
    });

    // Record ledger entry
    await addDoc(collection(db, 'ledger_transactions'), {
      transactionType: 'grant',
      initiatorId: 'admin',
      recipientId: userId,
      amount: Math.abs(amount),
      status: 'completed',
      description: `Admin manual balance adjustment for ${username} (${amount >= 0 ? '+' : ''}${amount})`,
      entries: [
        {
          accountType: 'bank_reserves',
          side: amount >= 0 ? 'debit' : 'credit',
          amount: Math.abs(amount),
          notes: `Admin balance adjustment`,
        },
        {
          accountType: 'player_wallet',
          side: amount >= 0 ? 'credit' : 'debit',
          amount: Math.abs(amount),
          ownerId: userId,
          notes: `Adjustment of Rs ${amount}`,
        },
      ],
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error adjusting user balance:', error);
    return { success: false, error: error.message || 'Failed to adjust balance' };
  }
}
