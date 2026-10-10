import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transferCoins } from '../../services/ledgerService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import {
  Send,
  Search,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  Coins,
  FileText,
  Printer,
  X,
} from 'lucide-react';

export const SendMoneyView: React.FC = () => {
  const { user, profile, wallet } = useAuth();

  // Search & Recipient selection
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Transfer inputs
  const [amount, setAmount] = useState<number>(500000);
  const [note, setNote] = useState<string>('');

  // Flow states
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{
    txId: string;
    sender: string;
    recipient: string;
    amount: number;
    note?: string;
    timestamp: string;
  } | null>(null);

  // Search players in Firestore
  const handleSearch = async () => {
    if (!recipientInput.trim() || !user) return;
    setIsSearching(true);
    setErrorMessage(null);

    try {
      const DUMMY_ACCOUNT_IDS = ['demo_player_alice', 'demo_player_bob', 'demo_player_charlie', 'admin_krishrana1835'];
      const snap = await getDocs(collection(db, 'users'));
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        .filter((u) => u.id !== user.uid && !DUMMY_ACCOUNT_IDS.includes(u.id)); // exclude self and dummies

      const queryTerm = recipientInput.trim().toLowerCase();
      const filtered = all.filter(
        (u) =>
          u.username.toLowerCase().includes(queryTerm) ||
          u.id.toLowerCase() === queryTerm ||
          u.email.toLowerCase().includes(queryTerm)
      );

      setFoundUsers(filtered);
      if (filtered.length === 0) {
        setErrorMessage('No players found matching that username or ID.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Search error.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRecipient = (u: UserProfile) => {
    setSelectedRecipient(u);
    setRecipientInput(u.username);
    setFoundUsers([]);
    setErrorMessage(null);
  };

  const handleInitiateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedRecipient) {
      setErrorMessage('Please search and select an eligible recipient player.');
      return;
    }

    if (amount <= 0) {
      setErrorMessage('Transfer amount must be greater than 0.');
      return;
    }

    if (amount > (wallet?.availableBalance || 0)) {
      setErrorMessage(`Insufficient available balance. You have ${(wallet?.availableBalance || 0).toLocaleString()} coins.`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!user || !profile || !selectedRecipient) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await transferCoins(
      user.uid,
      profile.username,
      selectedRecipient.id,
      selectedRecipient.username,
      amount,
      note
    );

    setIsSubmitting(false);
    setShowConfirmModal(false);

    if (res.success) {
      setCompletedReceipt({
        txId: res.transactionId,
        sender: profile.username,
        recipient: selectedRecipient.username,
        amount,
        note,
        timestamp: new Date().toISOString(),
      });
      // reset form
      setSelectedRecipient(null);
      setRecipientInput('');
      setNote('');
      setAmount(100);
    } else {
      setErrorMessage(res.error || 'Transfer failed.');
    }
  };

  const remainingBalance = (wallet?.availableBalance || 0) - amount;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <Send className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Direct Player Transfer</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant, fee-free virtual coin transfers between registered players backed by authoritative ledger entries.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold">×</button>
        </div>
      )}

      {/* Main Transfer Form Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
        <form onSubmit={handleInitiateTransfer} className="space-y-5">
          {/* Step 1: Search Recipient */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Search Recipient Player
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Enter username or player ID..."
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    if (selectedRecipient) setSelectedRecipient(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !recipientInput.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
              >
                {isSearching ? 'Searching...' : 'Find Player'}
              </button>
            </div>

            {/* Found Users Dropdown Results */}
            {foundUsers.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {foundUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectRecipient(u)}
                    className="p-3 hover:bg-white cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{u.username}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {u.id.substring(0, 12)}...</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Select
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Recipient Card */}
            {selectedRecipient && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-900">
                      Recipient: {selectedRecipient.username}
                    </span>
                    <p className="text-[11px] text-emerald-700 font-mono">
                      User ID: {selectedRecipient.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Amount & Memo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Amount (₹)
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min={1}
                  max={50000000}
                  step={50000}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Available to spend: <span className="font-bold text-emerald-600">₹{(wallet?.availableBalance || 0).toLocaleString()}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                3. Memo / Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Thanks for the game!"
                maxLength={80}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Summary Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Transfer Amount:</span>
              <span className="font-bold text-slate-900">{amount.toLocaleString()} coins</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Transfer Fee:</span>
              <span className="font-bold text-emerald-600">0.00 coins (Free)</span>
            </div>
            <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2 font-medium">
              <span>Remaining Available Balance:</span>
              <span className={`font-bold ${remainingBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {remainingBalance.toLocaleString()} coins
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!selectedRecipient || amount <= 0 || remainingBalance < 0}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <span>Review & Confirm Transfer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedRecipient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Virtual Coin Transfer</h3>
            <p className="text-xs text-slate-600">
              Please verify the recipient details. Once confirmed, virtual coins will be transferred immediately via balanced ledger entries.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="font-bold text-slate-900">{selectedRecipient.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-emerald-600 text-sm">{amount.toLocaleString()} coins</span>
              </div>
              {note && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Memo:</span>
                  <span className="text-slate-700 italic">"{note}"</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">Sender Remaining Balance:</span>
                <span className="font-bold text-slate-900">{remainingBalance.toLocaleString()} coins</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={isSubmitting}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                {isSubmitting ? 'Transferring...' : 'Authorize Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Digital Receipt Modal */}
      {completedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold text-sm text-slate-900">Transfer Completed Successfully</span>
              </div>
              <button
                onClick={() => setCompletedReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-xs space-y-2.5 font-mono">
              <div className="text-center pb-2 border-b border-slate-200 font-sans">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">OFFICIAL TRANSACTION RECEIPT</p>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {completedReceipt.amount.toLocaleString()} Coins
                </p>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="text-slate-900 font-bold truncate max-w-[170px]">{completedReceipt.txId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sender:</span>
                <span className="text-slate-900">{completedReceipt.sender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Recipient:</span>
                <span className="text-slate-900">{completedReceipt.recipient}</span>
              </div>
              {completedReceipt.note && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Memo:</span>
                  <span className="text-slate-900 font-sans italic">{completedReceipt.note}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-700">{new Date(completedReceipt.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-emerald-700">
                <span>Final Status:</span>
                <span>COMPLETED & SETTLED</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setCompletedReceipt(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
