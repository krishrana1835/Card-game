import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SystemConfig, AuditLog, UserProfile, Wallet } from '../../types';
import { getSystemConfig, updateSystemConfig } from '../../services/configService';
import {
  createGameUser,
  updateUserPassword,
  adjustUserBalance,
} from '../../services/userService';
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  ShieldCheck,
  Settings,
  Landmark,
  Coins,
  History,
  AlertTriangle,
  CheckCircle,
  Users,
  Lock,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Play,
  Edit2,
  PlusCircle,
  Search,
  Sparkles,
  X,
  CreditCard,
} from 'lucide-react';

export const AdminPanelView: React.FC = () => {
  const { user, profile, isAdmin, loginAsUser } = useAuth();
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'config' | 'audit'>('users');

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [walletsMap, setWalletsMap] = useState<Record<string, Wallet>>({});
  const [stats, setStats] = useState({
    userCount: 0,
    roomCount: 0,
    totalTransactions: 0,
  });

  // Create User Form States
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('game123');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [newInitialBalance, setNewInitialBalance] = useState<number>(10000000); // 10,000,000 Rs
  const [newRole, setNewRole] = useState<'player' | 'admin'>('player');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // User list search filter
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');

  // Password edit modal
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editNewPassword, setEditNewPassword] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);

  // Balance adjustment modal
  const [adjustingUser, setAdjustingUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(5000000);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<boolean>(false);

  // Copied password feedback
  const [copiedPassId, setCopiedPassId] = useState<string | null>(null);

  // Config Form states
  const [startingGrant, setStartingGrant] = useState<number>(10000000);
  const [bankInterestRate, setBankInterestRate] = useState<number>(12);
  const [bankIntervalMinutes, setBankIntervalMinutes] = useState<number>(5);
  const [maxBankLoan, setMaxBankLoan] = useState<number>(50000000);
  const [maxTransfer, setMaxTransfer] = useState<number>(50000000);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    getSystemConfig().then((c) => {
      setConfig(c);
      setStartingGrant(c.startingGrant);
      setBankInterestRate(c.bankInterestRate);
      setBankIntervalMinutes(c.bankIntervalMinutes || 5);
      setMaxBankLoan(c.maxBankLoan);
      setMaxTransfer(c.maxTransfer);
    });

    // Audit logs listener
    const qLogs = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
        setAuditLogs(logs);
      },
      (err) => {
        console.warn('Audit logs listener warning:', err);
      }
    );

    // Users listener
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const users = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
        setUserList(users);
        setStats((prev) => ({ ...prev, userCount: users.length }));

        // Fetch wallets for each user
        users.forEach(async (u) => {
          try {
            const wSnap = await getDoc(doc(db, 'wallets', u.id));
            if (wSnap.exists()) {
              setWalletsMap((prev) => ({ ...prev, [u.id]: wSnap.data() as Wallet }));
            }
          } catch (e) {
            console.warn(`Wallet fetch warning for ${u.id}:`, e);
          }
        });
      },
      (err) => {
        console.warn('Users listener warning:', err);
      }
    );

    // Live counts
    Promise.all([
      getDocs(collection(db, 'game_rooms')),
      getDocs(collection(db, 'ledger_transactions')),
    ]).then(([roomsSnap, txSnap]) => {
      setStats((prev) => ({
        ...prev,
        roomCount: roomsSnap.docs.length,
        totalTransactions: txSnap.docs.length,
      }));
    });

    return () => {
      unsubLogs();
      unsubUsers();
    };
  }, []);

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-md mx-auto space-y-3">
        <Lock className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          The Admin Panel is strictly reserved for authorized administrators.
        </p>
      </div>
    );
  }

  // Handle User Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newUsername.trim()) {
      setCreateError('Username is required.');
      return;
    }
    if (!newPassword.trim()) {
      setCreateError('Password is required.');
      return;
    }

    setIsCreatingUser(true);
    const res = await createGameUser(
      {
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole,
        initialBalance: newInitialBalance,
      },
      user?.email || 'admin'
    );
    setIsCreatingUser(false);

    if (res.success && res.user) {
      setCreateSuccess(
        `User "${res.user.username}" created successfully with password "${newPassword}" and ₹${newInitialBalance.toLocaleString()} starting balance!`
      );
      setNewUsername('');
      setNewEmail('');
      setNewPassword('game123');
      setTimeout(() => setCreateSuccess(null), 5000);
    } else {
      setCreateError(res.error || 'Failed to create user.');
    }
  };

  // Copy password helper
  const handleCopyPassword = (uId: string, pwd?: string) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedPassId(uId);
    setTimeout(() => setCopiedPassId(null), 2000);
  };

  // Handle password update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editNewPassword.trim()) return;

    setIsUpdatingPassword(true);
    const res = await updateUserPassword(
      editingUser.id,
      editNewPassword,
      user?.email || 'admin'
    );
    setIsUpdatingPassword(false);

    if (res.success) {
      setEditingUser(null);
      setEditNewPassword('');
    } else {
      alert(res.error || 'Failed to update password');
    }
  };

  // Handle balance adjustment
  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingUser) return;

    setIsAdjustingBalance(true);
    const res = await adjustUserBalance(
      adjustingUser.id,
      adjustingUser.username,
      adjustAmount,
      user?.email || 'admin'
    );
    setIsAdjustingBalance(false);

    if (res.success) {
      setAdjustingUser(null);
    } else {
      alert(res.error || 'Failed to adjust balance');
    }
  };

  // Handle saving bank config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingConfig(true);
    setSaveSuccess(false);

    await updateSystemConfig(
      {
        startingGrant,
        bankInterestRate,
        bankIntervalMinutes,
        maxBankLoan,
        maxTransfer,
      },
      user.uid,
      user.email || 'admin'
    );

    setIsSavingConfig(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Filtered users
  const filteredUsers = userList.filter((u) => {
    const q = userSearchTerm.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight">System Administration</h1>
            <span className="text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700 px-2 py-0.5 rounded uppercase">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create user accounts with passwords, manage virtual bank loans, and audit transactions.
          </p>
        </div>

        <div className="text-xs font-mono bg-slate-800 px-3 py-1.5 rounded-lg text-slate-300 border border-slate-700 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Logged in: {user?.displayName || user?.email}</span>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Registered Players</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.userCount}</p>
          <span className="text-[10px] text-slate-400">All player profiles with wallets</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Game Rooms</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.roomCount}</p>
          <span className="text-[10px] text-slate-400">Active Teen Patti tables</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Ledger Entries</span>
            <History className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalTransactions}</p>
          <span className="text-[10px] text-slate-400">Authoritative double-entry records</span>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeAdminTab === 'users'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus className="w-4 h-4 text-emerald-600" />
          <span>User Management & Passwords</span>
          <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
            {userList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('config')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeAdminTab === 'config'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 text-blue-600" />
          <span>Virtual Bank & Rules Config</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('audit')}
          className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeAdminTab === 'audit'
              ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4 text-slate-600" />
          <span>System Audit Log</span>
          <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full text-[10px]">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: User Management & Creation */}
      {activeAdminTab === 'users' && (
        <div className="space-y-6">
          {/* Create User Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-emerald-600" />
                  <span>Create User Account with Password</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Admin can create new players. Players can immediately log in using their username and password.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                Initial Money: ₹10,000,000 Rs
              </span>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan, Player4, Priya"
                    value={newUsername}
                    onChange={(e) => {
                      setNewUsername(e.target.value);
                      if (!newEmail && e.target.value) {
                        setNewEmail(`${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')}@game.local`);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Used for player login & display</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="e.g. game123"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-16 border border-slate-200 rounded-lg font-mono text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    />
                    <div className="absolute right-1 top-1 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPassword(`pass_${Math.floor(1000 + Math.random() * 9000)}`)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono mr-1"
                        title="Generate random password"
                      >
                        Gen
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">Plain text password for game login</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. rohan@game.local"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Can also log in with this email</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Initial Starting Capital (₹ Rs)
                  </label>
                  <input
                    type="number"
                    min={500000}
                    step={500000}
                    value={newInitialBalance}
                    onChange={(e) => setNewInitialBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-emerald-600 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">
                    Default: ₹10,000,000 Rs (Credited immediately to user wallet)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'player' | 'admin')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="player">Standard Player</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <span className="text-[10px] text-slate-400">Admins have access to this management dashboard</span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>{isCreatingUser ? 'Creating User & Wallet...' : 'Create User Account'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* User Directory Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <span>All Registered Users ({userList.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  View credentials, wallet balances, switch player sessions, or update passwords.
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-slate-900"
                />
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No users found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Player / Username</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Password</th>
                      <th className="px-4 py-3">Available Balance</th>
                      <th className="px-4 py-3">Debt / Loans</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const w = walletsMap[u.id];
                      const isCurrentActive = user?.uid === u.id;

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isCurrentActive ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                                {u.username ? u.username[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                  <span>{u.username}</span>
                                  {isCurrentActive && (
                                    <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-semibold">
                                      Active Session
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {u.email || u.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {u.role === 'admin' ? (
                              <span className="text-[10px] font-bold bg-slate-900 text-emerald-400 px-2 py-0.5 rounded">
                                Admin
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                Player
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                                {u.password || '(not set)'}
                              </span>
                              {u.password && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyPassword(u.id, u.password)}
                                  className="text-slate-400 hover:text-slate-700 p-1"
                                  title="Copy password"
                                >
                                  {copiedPassId === u.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditNewPassword(u.password || '');
                                }}
                                className="text-slate-400 hover:text-slate-700 p-1"
                                title="Edit password"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="font-bold text-emerald-600">
                              ₹{(w?.availableBalance ?? 10000000).toLocaleString()}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            {(w?.outstandingBankDebt ?? 0) > 0 ? (
                              <span className="font-semibold text-rose-600">
                                ₹{w?.outstandingBankDebt.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">No debt</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustingUser(u);
                                  setAdjustAmount(5000000);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                                title="Add or deduct money"
                              >
                                ± Funds
                              </button>

                              <button
                                type="button"
                                onClick={() => loginAsUser(u)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold flex items-center space-x-1"
                                title="Log in as this user immediately"
                              >
                                <Play className="w-3 h-3 text-emerald-400" />
                                <span>Play As</span>
                              </button>
                            </div>
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
      )}

      {/* TAB 2: Virtual Bank Config */}
      {activeAdminTab === 'config' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Virtual Bank & System Parameters</h2>
              <p className="text-xs text-slate-500">
                System parameters configured per rules (initial grant: 10,000,000 Rs, bank loan: 50,000,000 Rs).
              </p>
            </div>
            {saveSuccess && (
              <span className="flex items-center space-x-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Config Saved Successfully</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Starting Coin Grant (Welcome Bonus ₹)
                </label>
                <input
                  type="number"
                  min={1000000}
                  max={100000000}
                  step={500000}
                  value={startingGrant}
                  onChange={(e) => setStartingGrant(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                />
                <span className="text-[11px] text-slate-500">
                  Fixed rule: ₹10,000,000 Rs initial capital for all players
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Max Single Player Transfer (₹)
                </label>
                <input
                  type="number"
                  min={100000}
                  max={100000000}
                  step={1000000}
                  value={maxTransfer}
                  onChange={(e) => setMaxTransfer(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                />
                <span className="text-[11px] text-slate-500">Safety ceiling for peer transfers</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bank Loan Interest Rate (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bankInterestRate}
                  onChange={(e) => setBankInterestRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                />
                <span className="text-[11px] text-slate-500">Default: 12% compound</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Interest Accrual Interval (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={bankIntervalMinutes}
                  onChange={(e) => setBankIntervalMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-blue-600"
                />
                <span className="text-[11px] text-blue-600 font-medium">Currently set to 5 minutes</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Maximum Bank Loan Ceiling (₹)
                </label>
                <input
                  type="number"
                  min={1000000}
                  max={100000000}
                  step={1000000}
                  value={maxBankLoan}
                  onChange={(e) => setMaxBankLoan(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                />
                <span className="text-[11px] text-slate-500">
                  Fixed rule: ₹50,000,000 Rs bank loan limit
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingConfig}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                {isSavingConfig ? 'Updating...' : 'Save Configuration Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Audit Logs */}
      {activeAdminTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Administrator Audit Trail</h3>
            </div>
            <span className="text-xs text-slate-400">Strictly immutable</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No administrative changes recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{log.action}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        by {log.performedByEmail}
                      </span>
                    </div>
                    <pre className="text-[11px] text-slate-600 mt-1 font-mono">
                      {JSON.stringify(log.details)}
                    </pre>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Edit User Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>Update Password for {editingUser.username}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Password</label>
                <input
                  type="text"
                  required
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-900"
                  placeholder="Enter new password"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  {isUpdatingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust User Balance */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Adjust Funds for {adjustingUser.username}</span>
              </h3>
              <button
                onClick={() => setAdjustingUser(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Amount to Grant or Deduct (₹)
                </label>
                <input
                  type="number"
                  step={500000}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold text-slate-900"
                />
                <span className="text-[10px] text-slate-400">
                  Positive values add money; negative values deduct money.
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjustingBalance}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  {isAdjustingBalance ? 'Applying...' : 'Apply Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
