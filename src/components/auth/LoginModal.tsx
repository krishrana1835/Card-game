import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import {
  LogIn,
  KeyRound,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X,
  Users,
  UserPlus,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdmin?: () => void;
}

const DUMMY_ACCOUNT_IDS = [
  'demo_player_alice',
  'demo_player_bob',
  'demo_player_charlie',
  'admin_krishrana1835',
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onOpenAdmin }) => {
  const { loginWithCredentials } = useAuth();
  const [identifier, setIdentifier] = useState('sofiamarshal77@gmail.com');
  const [password, setPassword] = useState('Krish');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available users list for easy discovery and testing
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
        .filter((u) => !DUMMY_ACCOUNT_IDS.includes(u.id));
      setAvailableUsers(users);
    });

    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your username or email.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const res = await loginWithCredentials(identifier.trim(), password.trim());
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMessage('Login successful! Loading account...');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 700);
    } else {
      setErrorMessage(res.error || 'Login failed. Please check your credentials.');
    }
  };

  const handleQuickFill = (u: UserProfile) => {
    setIdentifier(u.username || u.email);
    setPassword(u.password || '');
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Switch / Log In Account</h2>
              <p className="text-xs text-slate-400">Enter your credentials or select an account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-emerald-700 text-xs">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="sofiamarshal77@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Available Registered Accounts Quick Access */}
          {availableUsers.length > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Available Accounts ({availableUsers.length})</span>
                </span>
                <span className="text-[10px] text-slate-400">Tap to auto-fill</span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickFill(u)}
                    className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-between text-xs transition-colors group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>{u.username}</span>
                        {u.role === 'admin' ? (
                          <span className="text-[9px] bg-slate-900 text-emerald-400 px-1 py-0.2 rounded font-semibold">
                            Admin
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-semibold">
                            Player
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                        {u.email || u.id}
                      </p>
                    </div>

                    <div className="text-right">
                      {u.password ? (
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          PW: {u.password}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Active</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add New User Admin Action */}
          {onOpenAdmin && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenAdmin}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>Create new user in Admin Panel</span>
                </div>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-semibold">
                  Admin Panel &rarr;
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Virtual Game Banking</span>
          <span className="font-semibold text-slate-700">No real money</span>
        </div>
      </div>
    </div>
  );
};
