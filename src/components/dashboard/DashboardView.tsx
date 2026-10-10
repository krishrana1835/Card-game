import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Wallet as WalletIcon,
  Lock,
  BookmarkCheck,
  Building2,
  Users2,
  AlertCircle,
  PlusCircle,
  LogIn,
  Send,
  Landmark,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  History,
  ShieldCheck,
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { LedgerTransaction } from '../../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, profile, wallet } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState<LedgerTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(true);

  // Fetch recent transactions involving this user
  useEffect(() => {
    if (!user) return;

    // Listen to recent transactions
    const q = query(
      collection(db, 'ledger_transactions'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const allTx = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LedgerTransaction[];

        // Filter transactions related to user
        const userTx = allTx.filter(
          (tx) =>
            tx.initiatorId === user.uid ||
            tx.senderId === user.uid ||
            tx.recipientId === user.uid ||
            tx.entries.some((e) => e.ownerId === user.uid)
        );

        setRecentTransactions(userTx.slice(0, 6));
        setLoadingTx(false);
      },
      (err) => {
        console.warn('Dashboard ledger snapshot warning:', err);
        setLoadingTx(false);
      }
    );

    return () => unsub();
  }, [user]);

  const totalOwed = (wallet?.outstandingBankDebt || 0) + (wallet?.outstandingPrivateDebt || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Welcome */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {profile?.username || user?.displayName || 'Player'}
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
              ID: {user?.uid.substring(0, 8)}...
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative double-entry virtual banking and multiplayer Teen Patti betting room companion.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('game-rooms')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create / Join Room</span>
          </button>
          <button
            onClick={() => onNavigate('send-money')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Send Money</span>
          </button>
          <button
            onClick={() => onNavigate('bank-loans')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
          >
            <Landmark className="w-3.5 h-3.5 text-amber-600" />
            <span>Borrow Bank</span>
          </button>
          <button
            onClick={() => onNavigate('private-lending')}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
          >
            <HandCoins className="w-3.5 h-3.5 text-purple-600" />
            <span>Lend Coins</span>
          </button>
        </div>
      </div>

      {/* Financial Overview - ASSETS Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current Assets (Virtual Coins)
          </h2>
          <span className="text-xs text-slate-400">Reconciled against double-entry ledger</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Available Balance */}
          <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Available Balance</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-emerald-600">
                ₹{wallet?.availableBalance.toLocaleString() ?? '0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Safely spendable for bets, transfers, or lending.
            </p>
          </div>

          {/* Total Balance */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Balance</span>
              <WalletIcon className="w-4 h-4 text-slate-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-slate-900">
                ₹{wallet?.totalBalance.toLocaleString() ?? '0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Includes available, game escrow, and reserved offers.
            </p>
          </div>

          {/* Locked in Games */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Locked in Active Pots</span>
              <Lock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-amber-600">
                ₹{wallet?.lockedInGames.toLocaleString() ?? '0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Escrowed in live game rooms until round settles.
            </p>
          </div>

          {/* Reserved for Loans */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Reserved for Loan Offers</span>
              <BookmarkCheck className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-purple-600">
                ₹{wallet?.reservedInLoans.toLocaleString() ?? '0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Held for pending P2P loan offers awaiting acceptance.
            </p>
          </div>
        </div>
      </div>

      {/* Financial Overview - LIABILITIES Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current Liabilities (Amount Owed)
          </h2>
          <span className="text-xs text-slate-400">Accrues interest per configured interval</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Outstanding Bank Debt */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Outstanding Bank Debt</span>
              <Building2 className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-600">
                ₹{wallet?.outstandingBankDebt.toLocaleString() ?? '0'}
              </span>
              {(wallet?.outstandingBankDebt ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('bank-loans')}
                  className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs transition-colors"
                >
                  Repay Now
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              System bank principal and accrued interest. Click to repay.
            </p>
          </div>

          {/* Outstanding Private Debt */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Outstanding P2P Debt</span>
              <Users2 className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-bold text-rose-600">
                ₹{wallet?.outstandingPrivateDebt.toLocaleString() ?? '0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Owed to other players under active loan contracts.
            </p>
          </div>

          {/* Total Amount Currently Owed */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-rose-700 text-xs font-medium">
              <span>Total Current Liabilities</span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-rose-700">
                ₹{totalOwed.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-rose-600 mt-1">
              Net balance: ₹{((wallet?.totalBalance || 0) - totalOwed).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Account Performance Metrics */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Player Activity & Credit Metrics</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Games Played</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{profile?.gamesPlayed ?? 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Games Won</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{profile?.gamesWon ?? 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Loans Repaid</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{profile?.loansRepaid ?? 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Total Repaid Amount</p>
            <p className="text-lg font-bold text-slate-800 mt-1">
              {(profile?.totalRepaidAmount || 0).toLocaleString()} coins
            </p>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Recent Transactions</h2>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            View Full Ledger →
          </button>
        </div>

        {loadingTx ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading ledger records...</div>
        ) : recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No transactions found yet. You can play a game, send money, or borrow coins to get started!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentTransactions.map((tx) => {
                  const isCredit =
                    tx.recipientId === user?.uid ||
                    tx.transactionType === 'grant' ||
                    tx.transactionType === 'pot_win' ||
                    tx.transactionType === 'bank_borrow' ||
                    (tx.transactionType === 'p2p_disburse' && tx.recipientId === user?.uid);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="capitalize font-medium text-slate-800">
                          {tx.transactionType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-bold">
                        <span
                          className={`inline-flex items-center space-x-1 ${
                            isCredit ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isCredit ? '+' : '-'}
                            {tx.amount.toLocaleString()} coins
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                        {new Date(tx.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
