import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Gamepad2,
  Send,
  Landmark,
  HandCoins,
  History,
  Bell,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  Coins,
  LogIn,
  LogOut,
  Users,
  KeyRound,
} from 'lucide-react';
import { LoginModal } from '../auth/LoginModal';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenRoom?: (roomId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, profile, wallet, unreadCount, isAdmin, switchAccount, signInWithGoogle, signOut, loginAsUser } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [customUsers, setCustomUsers] = useState<UserProfile[]>([]);

  React.useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
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
    { id: 'profile', label: 'Profile & Security', icon: UserCheck },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldCheck });
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Coins className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold text-slate-900 tracking-tight">Teen Patti Virtual Banking</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Game Companion
                </span>
              </div>
              <p className="text-xs text-slate-500">Virtual currency multiplayer system & double-entry ledger</p>
            </div>
          </div>

          {/* Right Header Status & Account Switcher */}
          <div className="flex items-center space-x-4">
            {/* Live Balance Ticker */}
            {wallet && (
              <div className="hidden sm:flex items-center space-x-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
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
                {wallet.outstandingBankDebt > 0 && (
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-slate-500">Debt: </span>
                    <span className="font-semibold text-rose-600">
                      ₹{wallet.outstandingBankDebt.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Player Login Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
              title="Log in with username/email and password"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Player Login</span>
              <span className="sm:hidden">Login</span>
            </button>

            {/* Multi-Player Testing Account Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 transition-colors"
                title="Switch active player for multiplayer testing"
              >
                <Users className="w-3.5 h-3.5 text-slate-600" />
                <span className="max-w-[120px] truncate">{profile?.username || user?.displayName || 'User'}</span>
                {isAdmin && (
                  <span className="bg-slate-900 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded font-semibold">Admin</span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs max-h-[85vh] overflow-y-auto">
                  <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">Player Accounts</p>
                      <p className="text-[11px] text-slate-500">
                        Log in or switch accounts instantly
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowLoginModal(true);
                        setAccountMenuOpen(false);
                      }}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                    >
                      Login Form
                    </button>
                  </div>

                  {/* Login with credentials direct button */}
                  <div className="p-2 border-b border-slate-100">
                    <button
                      onClick={() => {
                        setShowLoginModal(true);
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center space-x-2 font-bold"
                    >
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      <span>Log In with Password</span>
                    </button>
                  </div>

                  {/* Custom Users Created in Firestore */}
                  {customUsers.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Custom Created Users ({customUsers.length})
                      </div>
                      {customUsers.slice(0, 5).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            loginAsUser(u);
                            setAccountMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between ${
                            user?.uid === u.id ? 'bg-emerald-50/60 font-bold' : ''
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{u.username}</span>
                            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                              {u.email || u.id}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1">
                            {u.role === 'admin' ? (
                              <span className="text-[9px] bg-slate-900 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                                Admin
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                                Player
                              </span>
                            )}
                            {user?.uid === u.id && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1"></span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Preset Accounts */}
                  <div className="py-1 border-t border-slate-100">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Preset Demo Accounts
                    </div>
                    <button
                      onClick={() => {
                        switchAccount('admin');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">Krish Rana (Admin)</span>
                        <p className="text-[11px] text-slate-500">krishrana1835@gmail.com</p>
                      </div>
                      <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded">Admin</span>
                    </button>

                    <button
                      onClick={() => {
                        switchAccount('alice');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">Alice (Player 1)</span>
                        <p className="text-[11px] text-slate-500">alice.player@teenpatti.app</p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Player</span>
                    </button>

                    <button
                      onClick={() => {
                        switchAccount('bob');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">Bob (Player 2)</span>
                        <p className="text-[11px] text-slate-500">bob.player@teenpatti.app</p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Player</span>
                    </button>

                    <button
                      onClick={() => {
                        switchAccount('charlie');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">Charlie (Player 3)</span>
                        <p className="text-[11px] text-slate-500">charlie.player@teenpatti.app</p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Player</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      onClick={() => {
                        signInWithGoogle();
                        setAccountMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 flex items-center space-x-2 text-slate-700"
                    >
                      <LogIn className="w-3.5 h-3.5 text-blue-600" />
                      <span>Sign in with Google Account</span>
                    </button>
                    {user && (
                      <button
                        onClick={() => {
                          signOut();
                          setAccountMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center space-x-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out / Switch</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* Main Navigation Bar */}
      <nav className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-xs font-semibold border-b-2 border-emerald-400'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </header>
  );
};
