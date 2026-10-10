import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BankLoan,
  SystemConfig,
} from '../../types';
import {
  calculateEligibility,
  applyForBankLoan,
  repayBankLoan,
  processAccrueBankInterest,
} from '../../services/loanService';
import { getSystemConfig } from '../../services/configService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Landmark,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ArrowRight,
  Info,
  DollarSign,
  History,
} from 'lucide-react';

export const BankLoansView: React.FC = () => {
  const { user, profile, wallet } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [activeLoan, setActiveLoan] = useState<BankLoan | null>(null);
  const [loanHistory, setLoanHistory] = useState<BankLoan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Application input
  const [requestedPrincipal, setRequestedPrincipal] = useState<number>(5000000);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Repayment modal
  const [showRepayModal, setShowRepayModal] = useState<boolean>(false);
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [isRepaying, setIsRepaying] = useState<boolean>(false);

  // Countdown to next 5-minute accrual
  const [secondsUntilAccrual, setSecondsUntilAccrual] = useState<number>(300);

  // Load config & subscribe to user's loans
  useEffect(() => {
    getSystemConfig().then((c) => {
      setConfig(c);
      if (c.maxBankLoan) {
        setRequestedPrincipal(Math.min(5000000, c.maxBankLoan));
      }
    });

    if (!user) return;

    const q = query(collection(db, 'bank_loans'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const allLoans = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankLoan));
      const active = allLoans.find((l) => l.status === 'active');
      const past = allLoans.filter((l) => l.status !== 'active');
      setActiveLoan(active || null);
      setLoanHistory(past);
      if (active) {
        const totalDue = Math.round((active.outstandingPrincipal + active.accruedInterest) * 100) / 100;
        setRepayAmount(totalDue);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Interval check for real-time interest accrual (every 5 seconds)
  useEffect(() => {
    if (!activeLoan) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const nextAccrualMs = new Date(activeLoan.nextAccrualAt).getTime();
      const diffSec = Math.max(0, Math.ceil((nextAccrualMs - now) / 1000));
      setSecondsUntilAccrual(diffSec);

      // If due, trigger interest accrual processor
      if (diffSec === 0) {
        processAccrueBankInterest(activeLoan);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeLoan]);

  const eligibility = calculateEligibility(
    profile,
    wallet,
    config?.maxBankLoan || 5000
  );

  const intervalMinutes = config?.bankIntervalMinutes || 5;
  const interestRate = config?.bankInterestRate || 12;

  // Estimated compound repayment calculation
  const est1Interval = Math.round(requestedPrincipal * (1 + interestRate / 100) * 100) / 100;
  const est2Intervals = Math.round(requestedPrincipal * Math.pow(1 + interestRate / 100, 2) * 100) / 100;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !wallet) return;

    setIsApplying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await applyForBankLoan(
      user.uid,
      profile.username,
      requestedPrincipal,
      profile,
      wallet
    );

    setIsApplying(false);

    if (res.success) {
      setSuccessMsg(`Bank loan of ${requestedPrincipal.toLocaleString()} coins approved and principal credited!`);
    } else {
      setErrorMsg(res.error || 'Loan application was not approved.');
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeLoan) return;

    setIsRepaying(true);
    setErrorMsg(null);

    const res = await repayBankLoan(activeLoan.id, user.uid, repayAmount);
    setIsRepaying(false);

    if (res.success) {
      setShowRepayModal(false);
      setSuccessMsg(`Payment of ${repayAmount.toLocaleString()} coins applied successfully!`);
    } else {
      setErrorMsg(res.error || 'Repayment failed.');
    }
  };

  const totalActiveDebt = activeLoan
    ? Math.round((activeLoan.outstandingPrincipal + activeLoan.accruedInterest) * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">System Bank Loans</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Virtual Credit Facility
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Borrow virtual coins from the system bank based on transparent deterministic credit scoring.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>
            Standard Policy:{' '}
            <strong className="text-slate-900">{interestRate}% Compound</strong> every{' '}
            <strong className="text-slate-900">{intervalMinutes} Minutes</strong>
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Deterministic Eligibility Scoring Breakdown Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Transparent Eligibility & Capacity Score</h2>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Credit Score:</span>
            <span className="text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded">
              {eligibility.score} / 100
            </span>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <span className="text-slate-500 block">Total Credit Ceiling</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {eligibility.maxEligibleLoan.toLocaleString()} coins
            </span>
            <span className="text-[10px] text-slate-400">Based on activity & score</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
            <span className="text-slate-500 block">Current Outstanding Debt</span>
            <span className="text-lg font-bold text-rose-600 mt-1 block">
              {eligibility.currentDebt.toLocaleString()} coins
            </span>
            <span className="text-[10px] text-slate-400">Bank & P2P liabilities</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
            <span className="text-emerald-800 block font-semibold">Available Borrowing Capacity</span>
            <span className="text-lg font-black text-emerald-600 mt-1 block">
              {eligibility.availableCapacity.toLocaleString()} coins
            </span>
            <span className="text-[10px] text-emerald-700">Immediate loan allowance</span>
          </div>
        </div>

        {/* Factors Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
          {eligibility.factors.map((f, i) => (
            <div key={i} className="flex items-start space-x-2 p-2 rounded bg-slate-50/60">
              {f.status === 'passed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-slate-800">{f.name}</p>
                <p className="text-[11px] text-slate-500">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {eligibility.requirementsForHigherLimit.length > 0 && (
          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong>Requirements to unlock higher credit limit: </strong>
            <span>{eligibility.requirementsForHigherLimit.join(' • ')}</span>
          </div>
        )}
      </div>

      {/* Active Loan Card if user has an active loan */}
      {activeLoan ? (
        <div className="bg-white border-2 border-rose-300 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-rose-600" />
                <h2 className="text-base font-bold text-slate-900">Active Bank Loan in Progress</h2>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Accruing
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Loan ID: {activeLoan.id} | Borrowed on {new Date(activeLoan.createdAt).toLocaleDateString()}
              </p>
            </div>

            <button
              onClick={() => {
                setRepayAmount(totalActiveDebt);
                setShowRepayModal(true);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              Make Repayment
            </button>
          </div>

          {/* Debt breakdown cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-slate-500">Initial Principal</span>
              <p className="text-base font-bold text-slate-900 mt-1">
                {activeLoan.principal.toLocaleString()} coins
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-slate-500">Outstanding Principal</span>
              <p className="text-base font-bold text-slate-900 mt-1">
                {activeLoan.outstandingPrincipal.toLocaleString()} coins
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-slate-500">Accrued Compound Interest</span>
              <p className="text-base font-bold text-rose-600 mt-1">
                +{activeLoan.accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} coins
              </p>
            </div>

            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
              <span className="text-rose-700 font-semibold">Total Repayment Due</span>
              <p className="text-lg font-black text-rose-700 mt-1">
                {totalActiveDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} coins
              </p>
            </div>
          </div>

          {/* Live countdown timer bar to next 5-min accrual */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-amber-900 font-medium">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Next {activeLoan.interestRate}% interest accrual in:{' '}
                <strong className="font-mono text-sm text-slate-900">
                  {Math.floor(secondsUntilAccrual / 60)}m {secondsUntilAccrual % 60}s
                </strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Policy: Accrues every {activeLoan.intervalMinutes || 5} minutes automatically
            </span>
          </div>
        </div>
      ) : (
        /* Loan Application Card when user does NOT have an active loan */
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Apply for System Bank Loan</h2>
            <p className="text-xs text-slate-500">
              Select desired principal within your eligible limit of {eligibility.availableCapacity.toLocaleString()} coins.
            </p>
          </div>

          <form onSubmit={handleApply} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
                Requested Principal Amount (Coins)
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={100}
                  max={eligibility.availableCapacity}
                  step={50}
                  required
                  value={requestedPrincipal}
                  onChange={(e) => setRequestedPrincipal(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Available Borrowing Capacity: <strong className="text-emerald-600">{eligibility.availableCapacity.toLocaleString()} coins</strong>
              </p>
            </div>

            {/* Estimated Repayment Schedule Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Pre-Agreement Terms & Schedule Preview</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-600">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-400 block font-medium">INTEREST RATE</span>
                  <span className="font-bold text-slate-900 text-xs">{interestRate}% per {intervalMinutes}m</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-400 block font-medium">AFTER 1 INTERVAL ({intervalMinutes}m)</span>
                  <span className="font-bold text-slate-900 text-xs">{est1Interval.toLocaleString()} coins</span>
                </div>
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <span className="text-slate-400 block font-medium">AFTER 2 INTERVALS ({intervalMinutes * 2}m)</span>
                  <span className="font-bold text-rose-600 text-xs">{est2Intervals.toLocaleString()} coins</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 pt-1">
                Compound interest will accrue on outstanding principal plus unpaid interest every {intervalMinutes} minutes until repaid.
              </p>
            </div>

            <button
              type="submit"
              disabled={isApplying || !eligibility.isEligible || requestedPrincipal > eligibility.availableCapacity}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              {isApplying ? 'Processing Application...' : `Accept Terms & Disburse ${requestedPrincipal.toLocaleString()} Coins`}
            </button>
          </form>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepayModal && activeLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Repay Bank Loan</h3>
            <p className="text-xs text-slate-600">
              Payments are strictly allocated: <strong>accrued interest first</strong>, then remaining funds apply toward principal reduction.
            </p>

            <form onSubmit={handleRepay} className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Outstanding Principal:</span>
                  <span className="font-bold text-slate-800">{activeLoan.outstandingPrincipal.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Accrued Interest:</span>
                  <span className="font-bold text-rose-600">+{activeLoan.accruedInterest.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                  <span className="text-slate-700">Total Due:</span>
                  <span className="text-slate-900">{totalActiveDebt.toLocaleString()} coins</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Repayment Amount (Coins)</label>
                <input
                  type="number"
                  min={1}
                  max={Math.min(totalActiveDebt, wallet?.availableBalance || 0)}
                  step={1}
                  required
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Available Balance: {(wallet?.availableBalance || 0).toLocaleString()} coins</span>
                  <button
                    type="button"
                    onClick={() => setRepayAmount(Math.min(totalActiveDebt, wallet?.availableBalance || 0))}
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    Pay Full Available
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRepayModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRepaying || repayAmount <= 0 || repayAmount > (wallet?.availableBalance || 0)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  {isRepaying ? 'Processing...' : 'Authorize Repayment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Bank Loans */}
      {loanHistory.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center space-x-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Past Repaid Bank Loans</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {loanHistory.map((l) => (
              <div key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">
                    {l.principal.toLocaleString()} coins borrowed
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Repaid on {new Date(l.createdAt).toLocaleDateString()} | Total Interest Paid: {(l.totalPaidInterest || 0).toLocaleString()} coins
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Fully Repaid
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
