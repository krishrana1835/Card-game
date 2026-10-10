import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import { LoginModal } from '../auth/LoginModal';
import {
  Gamepad2,
  Landmark,
  HandCoins,
  LayoutDashboard,
  Send,
  History,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  LogOut,
  Coins,
  Users,
  KeyRound,
  UserPlus,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

const DUMMY_ACCOUNT_IDS = [
  'demo_player_alice',
  'demo_player_bob',
  'demo_player_charlie',
  'admin_krishrana1835',
];

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, profile, wallet, isAdmin, switchAccount, signOut, loginAsUser } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [customUsers, setCustomUsers] = useState<UserProfile[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
          .filter((u) => !DUMMY_ACCOUNT_IDS.includes(u.id));
        setCustomUsers(list);
      },
      (err) => console.warn('Navbar users listener warning:', err)
    );
    return () => unsub();
  }, []);

  interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: number | string;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'game-rooms', label: 'Game Rooms', icon: Gamepad2 },
    { id: 'send-money', label: 'Send Money', icon: Send },
    { id: 'bank-loans', label: 'Bank Loans', icon: Landmark },
    { id: 'private-lending', label: 'Private Lending', icon: HandCoins },
    { id: 'transactions', label: 'Transactions', icon: History },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck });
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0"
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs shrink-0">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-sm sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                  Teen Patti Bank
                </span>
                <span className="hidden md:inline-flex text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Virtual Ledger
                </span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 truncate">
                Multiplayer system & bank loans
              </p>
            </div>
          </div>

          {/* Right Header Status & Account Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Live Balance Ticker (desktop) */}
            {wallet && (
              <div className="hidden md:flex items-center space-x-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500">Available: </span>
                  <span className="font-bold text-emerald-600">
                    ₹{wallet.availableBalance.toLocaleString()}
                  </span>
                </div>
                {wallet.lockedInGames > 0 && (
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-slate-500">Locked: </span>
                    <span className="font-semibold text-amber-600">
                      ₹{wallet.lockedInGames.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Account Switcher Button */}
            <div className="relative">
              <button
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center space-x-2 p-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-colors max-w-[200px] sm:max-w-[240px]"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0 border border-emerald-500/20">
                  {profile?.username ? profile.username[0].toUpperCase() : 'P'}
                </div>
                <div className="hidden sm:block min-w-0 pr-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {profile?.username || user?.displayName || 'Player'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">
                    {user?.email || 'Logged in'}
                  </p>
                </div>
                {isAdmin && (
                  <span className="hidden sm:inline-flex text-[9px] bg-slate-900 text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs max-h-[85vh] overflow-y-auto">
                  {/* Current user header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Account
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">
                          {profile?.username || user?.displayName || 'Active User'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          {user?.email || ''}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                          isAdmin
                            ? 'bg-slate-900 text-emerald-400'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isAdmin ? 'Admin' : 'Player'}
                      </span>
                    </div>
                    {wallet && (
                      <p className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-200">
                        Balance: ₹{wallet.availableBalance.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-2 border-b border-slate-100 space-y-1.5">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          onSelectTab('admin');
                          setAccountMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl flex items-center justify-between font-bold text-xs transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                          <span>+ Add New User</span>
                        </div>
                        <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-semibold">
                          Admin Panel
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowLoginModal(true);
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center space-x-2 font-bold text-xs transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      <span>Switch / Log In Another User</span>
                    </button>
                  </div>

                  {/* Registered Users List */}
                  {customUsers.length > 0 && (
                    <div className="py-2 border-b border-slate-100">
                      <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        <span>Registered Users ({customUsers.length})</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {customUsers.map((u) => {
                          const isCurrent = user?.uid === u.id;
                          return (
                            <button
                              key={u.id}
                              onClick={() => {
                                loginAsUser(u);
                                setAccountMenuOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between transition-colors ${
                                isCurrent ? 'bg-emerald-50/60 font-bold' : ''
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-slate-900 truncate block">
                                  {u.username}
                                </span>
                                <p className="text-[10px] text-slate-500 font-mono truncate">
                                  {u.email || u.id}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1.5 shrink-0">
                                {u.role === 'admin' ? (
                                  <span className="text-[9px] bg-slate-900 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                                    Admin
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                                    Player
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sign Out */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        signOut();
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 rounded-xl flex items-center space-x-2 font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Live Balance Ticker Strip */}
      {wallet && (
        <div className="md:hidden bg-slate-100 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between text-xs overflow-x-auto scrollbar-none">
          <div className="flex items-center space-x-1.5 whitespace-nowrap">
            <span className="text-slate-500">Available:</span>
            <span className="font-bold text-emerald-600">
              ₹{wallet.availableBalance.toLocaleString()}
            </span>
          </div>
          {wallet.lockedInGames > 0 && (
            <div className="flex items-center space-x-1 whitespace-nowrap pl-3 border-l border-slate-300">
              <span className="text-slate-500">Locked:</span>
              <span className="font-semibold text-amber-600">
                ₹{wallet.lockedInGames.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation Tabs Bar (Scrollable on mobile) */}
      <nav className="bg-white border-t border-slate-100 px-2 sm:px-6 lg:px-8 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
                {item.id === 'admin' && (
                  <span className="ml-1 text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-black">
                    ADMIN
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onOpenAdmin={() => {
          setShowLoginModal(false);
          if (!isAdmin) {
            switchAccount('admin');
          }
          onSelectTab('admin');
        }}
      />
    </header>
  );
};
