import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  BankLoan,
  PrivateLoan,
  UserProfile,
  Wallet,
  LedgerEntry,
} from '../types';
import { getSystemConfig } from './configService';

export interface EligibilityResult {
  score: number;
  maxEligibleLoan: number;
  availableCapacity: number;
  currentDebt: number;
  isEligible: boolean;
  factors: {
    name: string;
    status: 'passed' | 'warning' | 'failed';
    detail: string;
  }[];
  requirementsForHigherLimit: string[];
}

export function calculateEligibility(
  profile: UserProfile | null,
  wallet: Wallet | null,
  maxBankLoanCap: number
): EligibilityResult {
  if (!profile || !wallet) {
    return {
      score: 20,
      maxEligibleLoan: 500,
      availableCapacity: 500,
      currentDebt: 0,
      isEligible: true,
      factors: [{ name: 'Profile', status: 'warning', detail: 'New account' }],
      requirementsForHigherLimit: ['Play games and build repayment record.'],
    };
  }

  const currentDebt = (wallet.outstandingBankDebt || 0) + (wallet.outstandingPrivateDebt || 0);
  let score = 30; // base score for registered account
  const factors: EligibilityResult['factors'] = [];
  const requirements: string[] = [];

  // 1. Account verified
  if (profile.emailVerified) {
    score += 15;
    factors.push({ name: 'Email Verification', status: 'passed', detail: 'Verified active user (+15 pts)' });
  } else {
    factors.push({ name: 'Email Verification', status: 'warning', detail: 'Unverified email' });
    requirements.push('Verify email address for higher trust (+15 pts)');
  }

  // 2. Games played
  const games = profile.gamesPlayed || 0;
  if (games >= 10) {
    score += 25;
    factors.push({ name: 'Game Participation', status: 'passed', detail: `${games} games played (+25 pts)` });
  } else if (games >= 3) {
    score += 15;
    factors.push({ name: 'Game Participation', status: 'passed', detail: `${games} games played (+15 pts)` });
    requirements.push('Complete 10 or more games for max participation bonus');
  } else {
    factors.push({ name: 'Game Participation', status: 'warning', detail: `${games} games played (+0 pts)` });
    requirements.push('Play at least 3 multiplayer games to unlock standard limits');
  }

  // 3. Repayment track record
  const repaid = profile.loansRepaid || 0;
  if (repaid >= 3) {
    score += 30;
    factors.push({ name: 'Repayment History', status: 'passed', detail: `${repaid} loans successfully repaid (+30 pts)` });
  } else if (repaid >= 1) {
    score += 15;
    factors.push({ name: 'Repayment History', status: 'passed', detail: `${repaid} loan successfully repaid (+15 pts)` });
    requirements.push('Repay more loans on schedule to achieve excellent credit score');
  } else {
    factors.push({ name: 'Repayment History', status: 'warning', detail: 'No loans repaid yet' });
    requirements.push('Successfully borrow and repay initial micro-loan to build history');
  }

  // Cap score at 100
  score = Math.min(100, Math.max(10, score));

  // Determine borrowing ceiling based on score percentage of admin cap
  // Minimum tier is 1,000 coins, max tier is maxBankLoanCap
  const calculatedCeiling = Math.round(1000 + (score / 100) * (maxBankLoanCap - 1000));
  const maxEligibleLoan = Math.min(maxBankLoanCap, Math.max(500, calculatedCeiling));
  const availableCapacity = Math.max(0, maxEligibleLoan - currentDebt);
  const isEligible = availableCapacity > 0 && wallet.outstandingBankDebt === 0;

  if (wallet.outstandingBankDebt > 0) {
    factors.push({
      name: 'Existing Bank Debt',
      status: 'failed',
      detail: `You have ${wallet.outstandingBankDebt.toLocaleString()} coins outstanding. Only 1 concurrent bank loan permitted.`,
    });
    requirements.push('Fully repay your active bank loan before taking another.');
  }

  return {
    score,
    maxEligibleLoan,
    availableCapacity,
    currentDebt,
    isEligible,
    factors,
    requirementsForHigherLimit: requirements,
  };
}

export async function applyForBankLoan(
  userId: string,
  username: string,
  principal: number,
  profile: UserProfile,
  wallet: Wallet
): Promise<{ success: boolean; loanId?: string; error?: string }> {
  if (principal <= 0) return { success: false, error: 'Principal must be greater than 0.' };

  const config = await getSystemConfig();
  const eligibility = calculateEligibility(profile, wallet, config.maxBankLoan);

  if (!eligibility.isEligible) {
    return {
      success: false,
      error: wallet.outstandingBankDebt > 0
        ? 'You already have an active bank loan. Please repay it first.'
        : 'You do not qualify for a new loan under current limits.',
    };
  }

  if (principal > eligibility.availableCapacity) {
    return {
      success: false,
      error: `Requested principal exceeds your available borrowing capacity of ${eligibility.availableCapacity.toLocaleString()} coins.`,
    };
  }

  const now = new Date();
  const intervalMinutes = config.bankIntervalMinutes || 5;
  const nextAccrualDate = new Date(now.getTime() + intervalMinutes * 60 * 1000);

  const walletRef = doc(db, 'wallets', userId);
  const loansCollection = collection(db, 'bank_loans');
  const txCollection = collection(db, 'ledger_transactions');

  try {
    const loanId = await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists()) throw new Error('Wallet not found');
      const wData = wSnap.data() as Wallet;

      if (wData.outstandingBankDebt > 0) {
        throw new Error('You already have an active bank loan.');
      }

      const newAvail = Math.round((wData.availableBalance + principal) * 100) / 100;
      const newTotal = Math.round((wData.totalBalance + principal) * 100) / 100;
      const newBankDebt = Math.round((wData.outstandingBankDebt + principal) * 100) / 100;

      tx.update(walletRef, {
        availableBalance: newAvail,
        totalBalance: newTotal,
        outstandingBankDebt: newBankDebt,
        updatedAt: now.toISOString(),
      });

      const newLoanRef = doc(loansCollection);
      const newLoan: Omit<BankLoan, 'id'> = {
        userId,
        username,
        principal,
        outstandingPrincipal: principal,
        accruedInterest: 0,
        interestRate: config.bankInterestRate,
        intervalMinutes,
        compound: true,
        status: 'active',
        lastAccruedAt: now.toISOString(),
        nextAccrualAt: nextAccrualDate.toISOString(),
        totalPaidInterest: 0,
        totalPaidPrincipal: 0,
        createdAt: now.toISOString(),
      };
      tx.set(newLoanRef, newLoan);

      // Ledger entries
      const entries: LedgerEntry[] = [
        {
          accountType: 'bank_reserves',
          side: 'debit',
          amount: principal,
          notes: `System bank disbursed loan to ${username}`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount: principal,
          ownerId: userId,
          notes: `Loan principal credited to player wallet`,
        },
        {
          accountType: 'loan_receivables',
          side: 'debit',
          amount: principal,
          notes: `Loan liability tracked for user ${username}`,
        },
      ];

      const newTxRef = doc(txCollection);
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'bank_borrow',
        initiatorId: userId,
        recipientId: userId,
        referenceId: newLoanRef.id,
        amount: principal,
        status: 'completed',
        description: `Bank loan principal disbursed: ${principal.toLocaleString()} coins at ${config.bankInterestRate}%/${intervalMinutes}m`,
        entries,
        createdAt: now.toISOString(),
      });

      return newLoanRef.id;
    });

    return { success: true, loanId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function processAccrueBankInterest(loan: BankLoan): Promise<void> {
  if (loan.status !== 'active') return;

  const now = new Date();
  const nextAccrual = new Date(loan.nextAccrualAt);

  if (now.getTime() < nextAccrual.getTime()) return; // Not due yet

  const intervalMinutes = loan.intervalMinutes || 5;
  // Calculate periods passed
  const elapsedMs = now.getTime() - nextAccrual.getTime();
  const extraPeriods = Math.floor(elapsedMs / (intervalMinutes * 60 * 1000));
  const totalPeriodsToProcess = 1 + extraPeriods;

  let currentTotalDebt = loan.outstandingPrincipal + loan.accruedInterest;
  let totalNewInterest = 0;

  for (let i = 0; i < totalPeriodsToProcess; i++) {
    const periodInterest = (currentTotalDebt * (loan.interestRate / 100));
    totalNewInterest += periodInterest;
    if (loan.compound) {
      currentTotalDebt += periodInterest;
    }
  }

  totalNewInterest = Math.round(totalNewInterest * 100) / 100;
  if (totalNewInterest <= 0) return;

  const newAccruedInterest = Math.round((loan.accruedInterest + totalNewInterest) * 100) / 100;
  const newNextAccrual = new Date(nextAccrual.getTime() + totalPeriodsToProcess * intervalMinutes * 60 * 1000);

  const loanRef = doc(db, 'bank_loans', loan.id);
  const walletRef = doc(db, 'wallets', loan.userId);

  try {
    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists()) return;
      const wData = wSnap.data() as Wallet;

      tx.update(loanRef, {
        accruedInterest: newAccruedInterest,
        lastAccruedAt: now.toISOString(),
        nextAccrualAt: newNextAccrual.toISOString(),
      });

      const newBankDebt = Math.round((wData.outstandingBankDebt + totalNewInterest) * 100) / 100;
      tx.update(walletRef, {
        outstandingBankDebt: newBankDebt,
        updatedAt: now.toISOString(),
      });

      const entries: LedgerEntry[] = [
        {
          accountType: 'loan_receivables',
          side: 'debit',
          amount: totalNewInterest,
          notes: `Accrued interest on loan ${loan.id}`,
        },
        {
          accountType: 'interest_income',
          side: 'credit',
          amount: totalNewInterest,
          notes: `System bank interest earned from ${loan.username}`,
        },
      ];

      const newTxRef = doc(collection(db, 'ledger_transactions'));
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'bank_interest',
        initiatorId: 'system',
        recipientId: loan.userId,
        referenceId: loan.id,
        amount: totalNewInterest,
        status: 'completed',
        description: `Bank interest accrued: +${totalNewInterest.toLocaleString()} coins (${loan.interestRate}% interval)`,
        entries,
        createdAt: now.toISOString(),
      });
    });
  } catch (err) {
    console.error('Error accruing interest: ', err);
  }
}

export async function repayBankLoan(
  loanId: string,
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Repayment amount must be positive.' };

  const loanRef = doc(db, 'bank_loans', loanId);
  const walletRef = doc(db, 'wallets', userId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (tx) => {
      const loanSnap = await tx.get(loanRef);
      const walletSnap = await tx.get(walletRef);

      if (!loanSnap.exists()) throw new Error('Loan not found');
      if (!walletSnap.exists()) throw new Error('Wallet not found');

      const loan = loanSnap.data() as BankLoan;
      const wallet = walletSnap.data() as Wallet;

      if (wallet.availableBalance < amount) {
        throw new Error(`Insufficient available balance. You have ${wallet.availableBalance.toLocaleString()} coins.`);
      }

      const totalDebt = Math.round((loan.outstandingPrincipal + loan.accruedInterest) * 100) / 100;
      if (amount > totalDebt) {
        throw new Error(`Repayment amount (${amount.toLocaleString()}) exceeds total outstanding debt (${totalDebt.toLocaleString()}).`);
      }

      // Allocation policy: Accrued interest first, then principal
      let remainingPayment = amount;
      let interestPaid = 0;
      let principalPaid = 0;

      if (loan.accruedInterest > 0) {
        interestPaid = Math.min(loan.accruedInterest, remainingPayment);
        remainingPayment = Math.round((remainingPayment - interestPaid) * 100) / 100;
      }

      if (remainingPayment > 0) {
        principalPaid = Math.min(loan.outstandingPrincipal, remainingPayment);
      }

      const newAccruedInterest = Math.round((loan.accruedInterest - interestPaid) * 100) / 100;
      const newOutstandingPrincipal = Math.round((loan.outstandingPrincipal - principalPaid) * 100) / 100;
      const isFullyPaid = newOutstandingPrincipal <= 0 && newAccruedInterest <= 0;

      const newAvail = Math.round((wallet.availableBalance - amount) * 100) / 100;
      const newTotal = Math.round((wallet.totalBalance - amount) * 100) / 100;
      const newBankDebt = Math.max(0, Math.round((wallet.outstandingBankDebt - amount) * 100) / 100);

      const now = new Date().toISOString();

      tx.update(loanRef, {
        accruedInterest: newAccruedInterest,
        outstandingPrincipal: newOutstandingPrincipal,
        totalPaidInterest: Math.round(((loan.totalPaidInterest || 0) + interestPaid) * 100) / 100,
        totalPaidPrincipal: Math.round(((loan.totalPaidPrincipal || 0) + principalPaid) * 100) / 100,
        status: isFullyPaid ? 'paid' : 'active',
        updatedAt: now,
      });

      tx.update(walletRef, {
        availableBalance: newAvail,
        totalBalance: newTotal,
        outstandingBankDebt: newBankDebt,
        updatedAt: now,
      });

      if (isFullyPaid) {
        const uSnap = await tx.get(userRef);
        if (uSnap.exists()) {
          const u = uSnap.data() as UserProfile;
          tx.update(userRef, {
            loansRepaid: (u.loansRepaid || 0) + 1,
            totalRepaidAmount: Math.round(((u.totalRepaidAmount || 0) + amount) * 100) / 100,
            updatedAt: now,
          });
        }
      }

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount,
          ownerId: userId,
          notes: `Loan repayment: interest ${interestPaid.toLocaleString()}, principal ${principalPaid.toLocaleString()}`,
        },
        {
          accountType: 'bank_reserves',
          side: 'credit',
          amount: principalPaid,
          notes: `Principal recovered to bank reserves`,
        },
        {
          accountType: 'interest_income',
          side: 'credit',
          amount: interestPaid,
          notes: `Interest revenue collected`,
        },
      ];

      const newTxRef = doc(collection(db, 'ledger_transactions'));
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'bank_repay',
        initiatorId: userId,
        recipientId: 'bank',
        referenceId: loanId,
        amount,
        status: 'completed',
        description: `Repayment of ${amount.toLocaleString()} coins (Interest: ${interestPaid.toLocaleString()}, Principal: ${principalPaid.toLocaleString()})`,
        entries,
        createdAt: now,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =================== PRIVATE P2P LENDING ===================

export async function createPrivateLoanOffer(
  lenderId: string,
  lenderName: string,
  borrowerId: string,
  borrowerName: string,
  principal: number,
  interestRate: number,
  intervalMinutes: number,
  durationMinutes: number,
  compound: boolean,
  termsNote?: string
): Promise<{ success: boolean; error?: string }> {
  if (principal <= 0) return { success: false, error: 'Principal must be greater than 0.' };
  if (lenderId === borrowerId) return { success: false, error: 'Cannot lend to yourself.' };
  if (intervalMinutes <= 0) return { success: false, error: 'Interval must be at least 1 minute.' };

  const lenderWalletRef = doc(db, 'wallets', lenderId);
  const p2pCollection = collection(db, 'private_loans');
  const txCollection = collection(db, 'ledger_transactions');

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(lenderWalletRef);
      if (!snap.exists()) throw new Error('Lender wallet not found');
      const wData = snap.data() as Wallet;

      if (wData.availableBalance < principal) {
        throw new Error(`Insufficient available funds. You have ${wData.availableBalance.toLocaleString()} available.`);
      }

      // Reserve funds in lender wallet so they cannot be double-spent!
      const newAvail = Math.round((wData.availableBalance - principal) * 100) / 100;
      const newReserved = Math.round((wData.reservedInLoans + principal) * 100) / 100;
      const now = new Date().toISOString();

      tx.update(lenderWalletRef, {
        availableBalance: newAvail,
        reservedInLoans: newReserved,
        updatedAt: now,
      });

      const newLoanRef = doc(p2pCollection);
      const offerData: Omit<PrivateLoan, 'id'> = {
        lenderId,
        lenderName,
        borrowerId,
        borrowerName,
        principal,
        outstandingPrincipal: principal,
        accruedInterest: 0,
        interestRate,
        intervalMinutes,
        durationMinutes,
        compound,
        status: 'pending_offer',
        termsNote: termsNote || '',
        createdAt: now,
      };
      tx.set(newLoanRef, offerData);

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount: principal,
          ownerId: lenderId,
          notes: `Reserved for loan offer to ${borrowerName}`,
        },
      ];

      const newTxRef = doc(txCollection);
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'p2p_offer_reserve',
        initiatorId: lenderId,
        recipientId: borrowerId,
        referenceId: newLoanRef.id,
        amount: principal,
        status: 'completed',
        description: `Reserved ${principal.toLocaleString()} coins for P2P loan offer to ${borrowerName}`,
        entries,
        createdAt: now,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function respondToPrivateLoanOffer(
  loanId: string,
  borrowerId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const loanRef = doc(db, 'private_loans', loanId);

  try {
    await runTransaction(db, async (tx) => {
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists()) throw new Error('Loan offer not found');
      const loan = loanSnap.data() as PrivateLoan;

      if (loan.status !== 'pending_offer') throw new Error('Offer is no longer pending');
      if (loan.borrowerId !== borrowerId) throw new Error('Unauthorized');

      const lenderWalletRef = doc(db, 'wallets', loan.lenderId);
      const borrowerWalletRef = doc(db, 'wallets', loan.borrowerId);

      const lenderSnap = await tx.get(lenderWalletRef);
      const borrowerSnap = await tx.get(borrowerWalletRef);
      if (!lenderSnap.exists() || !borrowerSnap.exists()) throw new Error('Wallet not found');

      const lenderWallet = lenderSnap.data() as Wallet;
      const borrowerWallet = borrowerSnap.data() as Wallet;
      const now = new Date();

      if (!accept) {
        // Rejected: release reserved funds back to lender
        const newLenderAvail = Math.round((lenderWallet.availableBalance + loan.principal) * 100) / 100;
        const newLenderRes = Math.max(0, Math.round((lenderWallet.reservedInLoans - loan.principal) * 100) / 100);

        tx.update(lenderWalletRef, {
          availableBalance: newLenderAvail,
          reservedInLoans: newLenderRes,
          updatedAt: now.toISOString(),
        });

        tx.update(loanRef, { status: 'rejected' });
        return;
      }

      // Accepted: transfer principal from lender's reserved pool to borrower's wallet
      const newLenderRes = Math.max(0, Math.round((lenderWallet.reservedInLoans - loan.principal) * 100) / 100);
      const newLenderTotal = Math.round((lenderWallet.totalBalance - loan.principal) * 100) / 100;

      const newBorrowerAvail = Math.round((borrowerWallet.availableBalance + loan.principal) * 100) / 100;
      const newBorrowerTotal = Math.round((borrowerWallet.totalBalance + loan.principal) * 100) / 100;
      const newBorrowerDebt = Math.round((borrowerWallet.outstandingPrivateDebt + loan.principal) * 100) / 100;

      const nextAccrual = new Date(now.getTime() + (loan.intervalMinutes || 5) * 60 * 1000);

      tx.update(lenderWalletRef, {
        reservedInLoans: newLenderRes,
        totalBalance: newLenderTotal,
        updatedAt: now.toISOString(),
      });

      tx.update(borrowerWalletRef, {
        availableBalance: newBorrowerAvail,
        totalBalance: newBorrowerTotal,
        outstandingPrivateDebt: newBorrowerDebt,
        updatedAt: now.toISOString(),
      });

      tx.update(loanRef, {
        status: 'active',
        lastAccruedAt: now.toISOString(),
        nextAccrualAt: nextAccrual.toISOString(),
      });

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount: loan.principal,
          ownerId: loan.lenderId,
          notes: `P2P loan disbursed to ${loan.borrowerName}`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount: loan.principal,
          ownerId: loan.borrowerId,
          notes: `P2P loan received from ${loan.lenderName}`,
        },
      ];

      const newTxRef = doc(collection(db, 'ledger_transactions'));
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'p2p_disburse',
        initiatorId: borrowerId,
        senderId: loan.lenderId,
        recipientId: loan.borrowerId,
        referenceId: loanId,
        amount: loan.principal,
        status: 'completed',
        description: `P2P Loan agreement activated: ${loan.principal.toLocaleString()} coins from ${loan.lenderName}`,
        entries,
        createdAt: now.toISOString(),
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function repayPrivateLoan(
  loanId: string,
  borrowerId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Repayment amount must be positive.' };

  const loanRef = doc(db, 'private_loans', loanId);

  try {
    await runTransaction(db, async (tx) => {
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists()) throw new Error('Loan not found');
      const loan = loanSnap.data() as PrivateLoan;

      if (loan.borrowerId !== borrowerId) throw new Error('Unauthorized');
      if (loan.status !== 'active') throw new Error('Loan is not active');

      const borrowerWalletRef = doc(db, 'wallets', borrowerId);
      const lenderWalletRef = doc(db, 'wallets', loan.lenderId);

      const bSnap = await tx.get(borrowerWalletRef);
      const lSnap = await tx.get(lenderWalletRef);

      if (!bSnap.exists() || !lSnap.exists()) throw new Error('Wallet not found');

      const bWallet = bSnap.data() as Wallet;
      const lWallet = lSnap.data() as Wallet;

      if (bWallet.availableBalance < amount) {
        throw new Error(`Insufficient available coins. You have ${bWallet.availableBalance.toLocaleString()}.`);
      }

      const totalDebt = Math.round((loan.outstandingPrincipal + loan.accruedInterest) * 100) / 100;
      if (amount > totalDebt) {
        throw new Error(`Amount exceeds total outstanding balance of ${totalDebt.toLocaleString()} coins.`);
      }

      // Allocation: interest first, then principal
      let rem = amount;
      let intPaid = 0;
      let prinPaid = 0;

      if (loan.accruedInterest > 0) {
        intPaid = Math.min(loan.accruedInterest, rem);
        rem = Math.round((rem - intPaid) * 100) / 100;
      }
      if (rem > 0) {
        prinPaid = Math.min(loan.outstandingPrincipal, rem);
      }

      const newAccruedInterest = Math.round((loan.accruedInterest - intPaid) * 100) / 100;
      const newOutstandingPrincipal = Math.round((loan.outstandingPrincipal - prinPaid) * 100) / 100;
      const isPaid = newOutstandingPrincipal <= 0 && newAccruedInterest <= 0;

      const now = new Date().toISOString();

      // Borrower updates
      tx.update(borrowerWalletRef, {
        availableBalance: Math.round((bWallet.availableBalance - amount) * 100) / 100,
        totalBalance: Math.round((bWallet.totalBalance - amount) * 100) / 100,
        outstandingPrivateDebt: Math.max(0, Math.round((bWallet.outstandingPrivateDebt - amount) * 100) / 100),
        updatedAt: now,
      });

      // Lender updates
      tx.update(lenderWalletRef, {
        availableBalance: Math.round((lWallet.availableBalance + amount) * 100) / 100,
        totalBalance: Math.round((lWallet.totalBalance + amount) * 100) / 100,
        updatedAt: now,
      });

      tx.update(loanRef, {
        accruedInterest: newAccruedInterest,
        outstandingPrincipal: newOutstandingPrincipal,
        status: isPaid ? 'paid' : 'active',
      });

      const entries: LedgerEntry[] = [
        {
          accountType: 'player_wallet',
          side: 'debit',
          amount,
          ownerId: borrowerId,
          notes: `Repayment of P2P loan to ${loan.lenderName}`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount,
          ownerId: loan.lenderId,
          notes: `P2P loan repayment received from ${loan.borrowerName}`,
        },
      ];

      const newTxRef = doc(collection(db, 'ledger_transactions'));
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'p2p_repay',
        initiatorId: borrowerId,
        senderId: borrowerId,
        recipientId: loan.lenderId,
        referenceId: loanId,
        amount,
        status: 'completed',
        description: `P2P loan repayment of ${amount.toLocaleString()} coins from ${loan.borrowerName} to ${loan.lenderName}`,
        entries,
        createdAt: now,
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
