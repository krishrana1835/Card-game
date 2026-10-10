import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Wallet,
  LedgerTransaction,
  LedgerEntry,
} from '../types';
import { getSystemConfig } from './configService';

export async function getOrCreateWallet(userId: string, username: string): Promise<Wallet> {
  const walletRef = doc(db, 'wallets', userId);
  const snap = await getDoc(walletRef);
  const TARGET_STARTING = 10000000; // 10,000,000 Rs initial money

  if (snap.exists()) {
    const existingWallet = snap.data() as Wallet;
    // If existing wallet has less than 10,000,000 Rs, ensure it is upgraded to 10,000,000 Rs
    if (existingWallet.totalBalance < TARGET_STARTING) {
      const diff = TARGET_STARTING - existingWallet.totalBalance;
      const updatedWallet: Wallet = {
        ...existingWallet,
        availableBalance: existingWallet.availableBalance + diff,
        totalBalance: TARGET_STARTING,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(walletRef, updatedWallet, { merge: true });
      return updatedWallet;
    }
    return existingWallet;
  }

  const initialWallet: Wallet = {
    userId,
    username,
    availableBalance: TARGET_STARTING,
    lockedInGames: 0,
    reservedInLoans: 0,
    outstandingBankDebt: 0,
    outstandingPrivateDebt: 0,
    totalBalance: TARGET_STARTING,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(walletRef, initialWallet);

  // Record initial grant transaction in ledger
  const grantEntries: LedgerEntry[] = [
    {
      accountType: 'bank_reserves',
      side: 'debit',
      amount: TARGET_STARTING,
      notes: `Starting Rs 10,000,000 grant for ${username}`,
    },
    {
      accountType: 'player_wallet',
      side: 'credit',
      amount: TARGET_STARTING,
      ownerId: userId,
      notes: `Starting virtual funds credited`,
    },
  ];

  await addDoc(collection(db, 'ledger_transactions'), {
    transactionType: 'grant',
    initiatorId: 'system',
    recipientId: userId,
    amount: TARGET_STARTING,
    status: 'completed',
    description: `Welcome grant of ₹${TARGET_STARTING.toLocaleString()} virtual coins`,
    entries: grantEntries,
    createdAt: new Date().toISOString(),
  });

  return initialWallet;
}

export async function transferCoins(
  senderId: string,
  senderName: string,
  recipientId: string,
  recipientUsername: string,
  amount: number,
  note?: string
): Promise<{ success: boolean; transactionId: string; error?: string }> {
  if (amount <= 0) {
    return { success: false, transactionId: '', error: 'Transfer amount must be greater than 0.' };
  }
  if (senderId === recipientId) {
    return { success: false, transactionId: '', error: 'Cannot transfer coins to yourself.' };
  }

  const config = await getSystemConfig();
  if (amount > config.maxTransfer) {
    return {
      success: false,
      transactionId: '',
      error: `Maximum transfer limit is ${config.maxTransfer.toLocaleString()} coins.`,
    };
  }

  const senderWalletRef = doc(db, 'wallets', senderId);
  const recipientWalletRef = doc(db, 'wallets', recipientId);
  const txCollectionRef = collection(db, 'ledger_transactions');

  try {
    const result = await runTransaction(db, async (tx) => {
      const senderSnap = await tx.get(senderWalletRef);
      const recipientSnap = await tx.get(recipientWalletRef);

      if (!senderSnap.exists()) {
        throw new Error('Sender wallet does not exist.');
      }
      if (!recipientSnap.exists()) {
        throw new Error('Recipient wallet not found. Ensure recipient has an active account.');
      }

      const senderWallet = senderSnap.data() as Wallet;
      const recipientWallet = recipientSnap.data() as Wallet;

      if (senderWallet.availableBalance < amount) {
        throw new Error(`Insufficient available balance. You have ${senderWallet.availableBalance.toLocaleString()} coins.`);
      }

      // Compute new balances
      const newSenderAvail = Math.round((senderWallet.availableBalance - amount) * 100) / 100;
      const newSenderTotal = Math.round((senderWallet.totalBalance - amount) * 100) / 100;

      const newRecipAvail = Math.round((recipientWallet.availableBalance + amount) * 100) / 100;
      const newRecipTotal = Math.round((recipientWallet.totalBalance + amount) * 100) / 100;

      const now = new Date().toISOString();

      tx.update(senderWalletRef, {
        availableBalance: newSenderAvail,
        totalBalance: newSenderTotal,
        updatedAt: now,
      });

      tx.update(recipientWalletRef, {
        availableBalance: newRecipAvail,
        totalBalance: newRecipTotal,
        updatedAt: now,
      });

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount,
          ownerId: senderId,
          notes: `Transfer out to ${recipientUsername}`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount,
          ownerId: recipientId,
          notes: `Transfer in from ${senderName}`,
        },
      ];

      const newTxRef = doc(txCollectionRef);
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'transfer',
        initiatorId: senderId,
        senderId,
        recipientId,
        amount,
        status: 'completed',
        description: note || `Transfer of ${amount.toLocaleString()} coins to ${recipientUsername}`,
        entries,
        createdAt: now,
      });

      return newTxRef.id;
    });

    return { success: true, transactionId: result };
  } catch (err: any) {
    console.error('Transfer failed: ', err);
    return { success: false, transactionId: '', error: err.message || 'Transfer failed.' };
  }
}

export async function lockBetCoins(
  userId: string,
  username: string,
  roomId: string,
  roomName: string,
  amount: number,
  actionType: 'boot' | 'chaal' | 'raise' | 'show'
): Promise<{ success: boolean; error?: string }> {
  const walletRef = doc(db, 'wallets', userId);
  const txCollectionRef = collection(db, 'ledger_transactions');

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(walletRef);
      if (!snap.exists()) throw new Error('Player wallet not found');
      const wallet = snap.data() as Wallet;

      if (wallet.availableBalance < amount) {
        throw new Error(`Insufficient available coins. Available: ${wallet.availableBalance.toLocaleString()}`);
      }

      const newAvail = Math.round((wallet.availableBalance - amount) * 100) / 100;
      const newLocked = Math.round((wallet.lockedInGames + amount) * 100) / 100;
      const now = new Date().toISOString();

      tx.update(walletRef, {
        availableBalance: newAvail,
        lockedInGames: newLocked,
        updatedAt: now,
      });

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount,
          ownerId: userId,
          notes: `${actionType.toUpperCase()} bet in room "${roomName}"`,
        },
        {
          accountType: 'game_escrow_pot',
          side: 'credit',
          amount,
          ownerId: roomId,
          notes: `Escrow pot deposit for room "${roomName}"`,
        },
      ];

      const newTxRef = doc(txCollectionRef);
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'bet',
        initiatorId: userId,
        senderId: userId,
        referenceId: roomId,
        amount,
        status: 'completed',
        description: `${actionType.toUpperCase()} bet of ${amount.toLocaleString()} coins in "${roomName}"`,
        entries,
        createdAt: now,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function settleGamePayout(
  roomId: string,
  roomName: string,
  winnerId: string,
  winnerName: string,
  potAmount: number,
  participants: { userId: string; username: string; lockedAmount: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (tx) => {
      // 1. ALL READS FIRST (Firestore requires all reads before any writes)
      // Fetch winner wallet
      const winnerWalletRef = doc(db, 'wallets', winnerId);
      const winnerSnap = await tx.get(winnerWalletRef);
      if (!winnerSnap.exists()) throw new Error('Winner wallet not found');

      // Fetch all participants' wallets
      const participantDocs: { ref: any; data: Wallet; lockedToClear: number }[] = [];
      for (const p of participants) {
        const pRef = doc(db, 'wallets', p.userId);
        const pSnap = await tx.get(pRef);
        if (pSnap.exists()) {
          participantDocs.push({
            ref: pRef,
            data: pSnap.data() as Wallet,
            lockedToClear: p.lockedAmount,
          });
        }
      }

      // Fetch winner user profile
      const winnerUserRef = doc(db, 'users', winnerId);
      const winnerUserSnap = await tx.get(winnerUserRef);

      // Fetch other participants' user profiles
      const otherUserDocs: { ref: any; data: any }[] = [];
      for (const p of participants) {
        if (p.userId !== winnerId) {
          const uRef = doc(db, 'users', p.userId);
          const uSnap = await tx.get(uRef);
          if (uSnap.exists()) {
            otherUserDocs.push({
              ref: uRef,
              data: uSnap.data(),
            });
          }
        }
      }

      // Fetch room doc
      const roomRef = doc(db, 'game_rooms', roomId);
      const roomSnap = await tx.get(roomRef);

      // 2. ALL WRITES AFTER READS (NO READS PAST THIS POINT)
      const now = new Date().toISOString();

      // Update participant wallets (release locked commitments and credit pot to winner)
      for (const pDoc of participantDocs) {
        const currentLocked = pDoc.data.lockedInGames || 0;
        const newLocked = Math.max(0, Math.round((currentLocked - pDoc.lockedToClear) * 100) / 100);

        if (pDoc.data.userId === winnerId) {
          const newAvail = Math.round((pDoc.data.availableBalance + potAmount) * 100) / 100;
          const newTotal = Math.round((pDoc.data.totalBalance - pDoc.lockedToClear + potAmount) * 100) / 100;

          tx.update(pDoc.ref, {
            availableBalance: newAvail,
            lockedInGames: newLocked,
            totalBalance: newTotal,
            updatedAt: now,
          });
        } else {
          const newTotal = Math.max(0, Math.round((pDoc.data.totalBalance - pDoc.lockedToClear) * 100) / 100);

          tx.update(pDoc.ref, {
            lockedInGames: newLocked,
            totalBalance: newTotal,
            updatedAt: now,
          });
        }
      }

      // Record immutable double-entry ledger transaction
      const entries: LedgerEntry[] = [
        {
          accountType: 'game_escrow_pot',
          side: 'debit',
          amount: potAmount,
          ownerId: roomId,
          notes: `Pot released from room "${roomName}" to winner ${winnerName}`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount: potAmount,
          ownerId: winnerId,
          notes: `Winnings credited for room "${roomName}"`,
        },
      ];

      const newTxRef = doc(collection(db, 'ledger_transactions'));
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'pot_win',
        initiatorId: winnerId,
        recipientId: winnerId,
        referenceId: roomId,
        amount: potAmount,
        status: 'completed',
        description: `Winnings payout of ₹${potAmount.toLocaleString()} coins from room "${roomName}"`,
        entries,
        createdAt: now,
      });

      // Update winner user stats
      if (winnerUserSnap.exists()) {
        const u = winnerUserSnap.data();
        tx.update(winnerUserRef, {
          gamesWon: (u.gamesWon || 0) + 1,
          gamesPlayed: (u.gamesPlayed || 0) + 1,
          updatedAt: now,
        });
      }

      // Update other participants gamesPlayed
      for (const oDoc of otherUserDocs) {
        tx.update(oDoc.ref, {
          gamesPlayed: ((oDoc.data.gamesPlayed as number) || 0) + 1,
          updatedAt: now,
        });
      }

      // Mark room as completed atomically
      if (roomSnap.exists()) {
        tx.update(roomRef, {
          status: 'completed',
          updatedAt: now,
        });
      }
    });

    return { success: true };
  } catch (err: any) {
    console.error('Settle pot payout error: ', err);
    return { success: false, error: err.message };
  }
}
