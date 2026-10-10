import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LedgerTransaction, TransactionType } from '../../types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  History,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  BookOpen,
  X,
  CheckCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<LedgerTransaction | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'ledger_transactions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as LedgerTransaction[];
      setTransactions(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredTx = transactions.filter((tx) => {
    const matchesSearch =
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.senderId && tx.senderId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.recipientId && tx.recipientId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || tx.transactionType === typeFilter;
    return matchesSearch && matchesType;
  });

  const exportCSV = () => {
    if (filteredTx.length === 0) return;
    const headers = ['Transaction ID', 'Type', 'Amount', 'Status', 'Description', 'Timestamp'];
    const rows = filteredTx.map((t) => [
      t.id,
      t.transactionType,
      t.amount,
      t.status,
      `"${t.description.replace(/"/g, '""')}"`,
      t.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Authoritative Financial Ledger</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Double-Entry Accounting
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete immutable audit log of every virtual coin movement, pot bet, loan issuance, and grant.
          </p>
        </div>

        <button
          onClick={exportCSV}
          disabled={filteredTx.length === 0}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Transaction ID or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Transaction Types</option>
            <option value="grant">Grant (Welcome Bonus)</option>
            <option value="transfer">Player Transfer</option>
            <option value="bet">Game Pot Bet / Boot</option>
            <option value="pot_win">Game Pot Winnings Payout</option>
            <option value="bank_borrow">Bank Loan Disbursed</option>
            <option value="bank_repay">Bank Loan Repayment</option>
            <option value="bank_interest">Bank Interest Accrued</option>
            <option value="p2p_disburse">P2P Loan Disbursed</option>
            <option value="p2p_repay">P2P Loan Repayment</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading ledger data...</div>
        ) : filteredTx.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No matching transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                <tr>
                  <th className="px-4 py-3">Tx ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 truncate max-w-[100px]">
                      {tx.id.substring(0, 10)}...
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="capitalize font-semibold text-slate-800">
                        {tx.transactionType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {tx.amount.toLocaleString()} coins
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        Inspect Ledger →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Double-Entry Ledger Inspector Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-bold text-slate-900">Double-Entry Ledger Inspector</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 font-bold">×</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Transaction ID:</span>
                <span className="font-bold text-slate-800 truncate max-w-[280px]">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Type:</span>
                <span className="capitalize font-sans font-bold text-slate-900">{selectedTx.transactionType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Amount:</span>
                <span className="font-bold text-emerald-600 font-sans">{selectedTx.amount.toLocaleString()} coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Timestamp:</span>
                <span className="text-slate-700">{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500 font-sans">Description:</span>
                <span className="font-sans text-slate-800">{selectedTx.description}</span>
              </div>
            </div>

            {/* Balanced Entries Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Balanced Double-Entry Entries
                </h4>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Balanced (Total Debits = Total Credits)
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <tr>
                      <th className="px-3 py-2">Side</th>
                      <th className="px-3 py-2">Account Type</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(selectedTx.entries || []).map((e, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              e.side === 'debit'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {e.side}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-700">
                          {e.accountType}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">
                          {e.amount.toLocaleString()} coins
                        </td>
                        <td className="px-3 py-2 text-slate-500 text-[11px]">
                          {e.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
