import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PrivateLoan, UserProfile } from '../../types';
import {
  createPrivateLoanOffer,
  respondToPrivateLoanOffer,
  repayPrivateLoan,
} from '../../services/loanService';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  HandCoins,
  PlusCircle,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  BookmarkCheck,
  AlertCircle,
  Coins,
  ShieldCheck,
} from 'lucide-react';

export const PrivateLendingView: React.FC = () => {
  const { user, profile, wallet } = useAuth();
  const [loansLent, setLoansLent] = useState<PrivateLoan[]>([]);
  const [loansBorrowed, setLoansBorrowed] = useState<PrivateLoan[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<PrivateLoan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'borrowed' | 'lent' | 'offers'>('borrowed');

  // Create Offer Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [borrowerSearch, setBorrowerSearch] = useState<string>('');
  const [foundBorrowers, setFoundBorrowers] = useState<UserProfile[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<UserProfile | null>(null);
  const [principal, setPrincipal] = useState<number>(1000000); // default 1,000,000 Rs
  const [interestRate, setInterestRate] = useState<number>(10);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(5);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [compound, setCompound] = useState<boolean>(true);
  const [termsNote, setTermsNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Repayment Modal
  const [selectedRepayLoan, setSelectedRepayLoan] = useState<PrivateLoan | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [isRepaying, setIsRepaying] = useState<boolean>(false);

  // Listen to P2P loans
  useEffect(() => {
    if (!user) return;

    // Lender loans
    const qLender = query(collection(db, 'private_loans'), where('lenderId', '==', user.uid));
    const unsubLender = onSnapshot(qLender, (snap) => {
      const lent = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrivateLoan));
      setLoansLent(lent);
    });

    // Borrower loans
    const qBorrower = query(collection(db, 'private_loans'), where('borrowerId', '==', user.uid));
    const unsubBorrower = onSnapshot(qBorrower, (snap) => {
      const allBorrower = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrivateLoan));
      const offers = allBorrower.filter((l) => l.status === 'pending_offer');
      const activeOrPast = allBorrower.filter((l) => l.status !== 'pending_offer');
      setIncomingOffers(offers);
      setLoansBorrowed(activeOrPast);
      setLoading(false);
    });

    return () => {
      unsubLender();
      unsubBorrower();
    };
  }, [user]);

  const handleSearchBorrower = async () => {
    if (!borrowerSearch.trim() || !user) return;
    try {
      const DUMMY_ACCOUNT_IDS = ['demo_player_alice', 'demo_player_bob', 'demo_player_charlie', 'admin_krishrana1835'];
      const snap = await getDocs(collection(db, 'users'));
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.id !== user.uid && !DUMMY_ACCOUNT_IDS.includes(u.id));
      const filtered = all.filter(
        (u) =>
          u.username.toLowerCase().includes(borrowerSearch.toLowerCase()) ||
          u.id.toLowerCase() === borrowerSearch.toLowerCase()
      );
      setFoundBorrowers(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedBorrower) return;

    if (principal > (wallet?.availableBalance || 0)) {
      setErrorMsg(`Offered principal (${principal}) exceeds your available balance (${wallet?.availableBalance || 0}).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createPrivateLoanOffer(
      user.uid,
      profile.username,
      selectedBorrower.id,
      selectedBorrower.username,
      principal,
      interestRate,
      intervalMinutes,
      durationMinutes,
      compound,
      termsNote
    );

    setIsSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      setSelectedBorrower(null);
      setBorrowerSearch('');
      setActiveTab('lent');
    } else {
      setErrorMsg(res.error || 'Failed to create loan offer.');
    }
  };

  const handleRespondOffer = async (loanId: string, accept: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    const res = await respondToPrivateLoanOffer(loanId, user.uid, accept);
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to respond to offer.');
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRepayLoan) return;

    setIsRepaying(true);
    setErrorMsg(null);

    const res = await repayPrivateLoan(selectedRepayLoan.id, user.uid, repayAmount);
    setIsRepaying(false);

    if (res.success) {
      setSelectedRepayLoan(null);
    } else {
      setErrorMsg(res.error || 'Failed to process repayment.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Private Player-to-Player Lending</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Escrow Protected
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Lend coins to other players at custom interest rates. Offered principal is securely reserved until accepted or declined.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span>Create Loan Offer</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-2 sm:space-x-4 overflow-x-auto scrollbar-none pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('borrowed')}
          className={`pb-2.5 sm:pb-3 px-1 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'borrowed'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Borrowed ({loansBorrowed.filter((l) => l.status === 'active').length} Active)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lent')}
          className={`pb-2.5 sm:pb-3 px-1 text-xs font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'lent'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Lent ({loansLent.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('offers')}
          className={`pb-2.5 sm:pb-3 px-1 text-xs font-bold whitespace-nowrap transition-colors border-b-2 flex items-center space-x-1.5 ${
            activeTab === 'offers'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Incoming Offers</span>
          {incomingOffers.length > 0 && (
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {incomingOffers.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content: Incoming Offers */}
      {activeTab === 'offers' && (
        <div className="space-y-3">
          {incomingOffers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              No pending loan offers from other players.
            </div>
          ) : (
            incomingOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-slate-900">
                      {offer.principal.toLocaleString()} Coins
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      From {offer.lenderName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Terms: <strong className="text-slate-900">{offer.interestRate}% Interest</strong> every {offer.intervalMinutes || 5} minutes ({offer.compound ? 'Compound' : 'Simple'})
                  </p>
                  {offer.termsNote && (
                    <p className="text-xs text-slate-500 italic mt-0.5">"{offer.termsNote}"</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRespondOffer(offer.id, true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Accept Offer
                  </button>
                  <button
                    onClick={() => handleRespondOffer(offer.id, false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content: Loans I Borrowed */}
      {activeTab === 'borrowed' && (
        <div className="space-y-3">
          {loansBorrowed.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              You currently have no active or historical loans borrowed from other players.
            </div>
          ) : (
            loansBorrowed.map((loan) => {
              const totalDue = Math.round((loan.outstandingPrincipal + loan.accruedInterest) * 100) / 100;
              return (
                <div
                  key={loan.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-slate-900">
                        {totalDue.toLocaleString()} Coins Total Owed
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          loan.status === 'active'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {loan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Lender: <strong className="text-slate-700">{loan.lenderName}</strong> | Principal: {loan.outstandingPrincipal.toLocaleString()} coins | Interest: {loan.interestRate}% per {loan.intervalMinutes || 5}m
                    </p>
                  </div>

                  {loan.status === 'active' && (
                    <button
                      onClick={() => {
                        setSelectedRepayLoan(loan);
                        setRepayAmount(totalDue);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      Repay Lender
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab Content: Loans I Lent */}
      {activeTab === 'lent' && (
        <div className="space-y-3">
          {loansLent.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              You haven't issued any loans to other players yet.
            </div>
          ) : (
            loansLent.map((loan) => (
              <div
                key={loan.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold text-slate-900">
                      {loan.principal.toLocaleString()} Coins Lent
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        loan.status === 'active'
                          ? 'bg-amber-100 text-amber-800'
                          : loan.status === 'pending_offer'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {loan.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Borrower: <strong className="text-slate-700">{loan.borrowerName}</strong> | Interest: {loan.interestRate}% per {loan.intervalMinutes || 5}m
                  </p>
                  {loan.status === 'pending_offer' && (
                    <p className="text-[11px] text-purple-600 mt-0.5">
                      • {loan.principal.toLocaleString()} coins currently reserved in your wallet awaiting response.
                    </p>
                  )}
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400 block">Current Status</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {loan.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Loan Offer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Private Loan Offer</h3>
                <p className="text-xs text-slate-500">Lend virtual coins to another registered player</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4 text-xs">
              {/* Step 1: Search Borrower */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Search Borrower Player</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter borrower username..."
                    value={borrowerSearch}
                    onChange={(e) => setBorrowerSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSearchBorrower}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold"
                  >
                    Search
                  </button>
                </div>

                {foundBorrowers.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50 divide-y divide-slate-100 max-h-36 overflow-y-auto">
                    {foundBorrowers.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBorrower(b);
                          setBorrowerSearch(b.username);
                          setFoundBorrowers([]);
                        }}
                        className="p-2.5 hover:bg-white cursor-pointer flex justify-between"
                      >
                        <span className="font-semibold text-slate-800">{b.username}</span>
                        <span className="text-emerald-600 font-medium text-[10px]">Select</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedBorrower && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-800 font-semibold">
                    Target Borrower: {selectedBorrower.username}
                  </div>
                )}
              </div>

              {/* Principal & Terms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Principal (Coins)</label>
                  <input
                    type="number"
                    min={50}
                    max={wallet?.availableBalance || 5000}
                    required
                    value={principal}
                    onChange={(e) => setPrincipal(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Available: {(wallet?.availableBalance || 0).toLocaleString()} coins</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Accrues per interval</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Interval (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Interest Calculation</label>
                  <select
                    value={compound ? 'true' : 'false'}
                    onChange={(e) => setCompound(e.target.value === 'true')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="true">Compound Interest</option>
                    <option value="false">Simple Interest</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Terms Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Please repay by tomorrow evening"
                  value={termsNote}
                  onChange={(e) => setTermsNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-[11px]">
                Upon sending this offer, <strong>{principal.toLocaleString()} coins</strong> will be immediately reserved from your available balance so they cannot be spent elsewhere.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedBorrower || principal <= 0}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs"
                >
                  {isSubmitting ? 'Sending Offer...' : 'Send Loan Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {selectedRepayLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Repay P2P Loan to {selectedRepayLoan.lenderName}</h3>
            <form onSubmit={handleRepay} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding Principal:</span>
                  <span className="font-bold">{selectedRepayLoan.outstandingPrincipal.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Accrued Interest:</span>
                  <span className="font-bold text-rose-600">+{selectedRepayLoan.accruedInterest.toLocaleString()} coins</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Amount (Coins)</label>
                <input
                  type="number"
                  min={1}
                  max={wallet?.availableBalance || 5000}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRepayLoan(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRepaying || repayAmount <= 0}
                  className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
