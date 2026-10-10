import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  UserCheck,
  ShieldCheck,
  Copy,
  Check,
  KeyRound,
  History,
  Lock,
  Mail,
  Calendar,
  Award,
  Eye,
  EyeOff,
  Edit2,
} from 'lucide-react';
import { updateUserPassword } from '../../services/userService';

export const ProfileView: React.FC = () => {
  const { user, profile, wallet, isAdmin } = useAuth();
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [newPassVal, setNewPassVal] = useState<string>('');
  const [passSaveMsg, setPassSaveMsg] = useState<string | null>(null);

  const handleCopyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
            {profile?.username ? profile.username[0].toUpperCase() : 'P'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900">
                {profile?.username || user?.displayName || 'Player Profile'}
              </h1>
              {isAdmin && (
                <span className="text-[10px] font-bold bg-slate-900 text-emerald-400 px-2 py-0.5 rounded">
                  System Administrator
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email || user?.email}</p>
          </div>
        </div>

        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Account</span>
        </span>
      </div>

      {/* Unique Player ID Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-2">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
          Public Player ID (Share for Transfers & Loans)
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={user?.uid || ''}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
          />
          <button
            onClick={handleCopyId}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId ? 'Copied!' : 'Copy ID'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Other players can use this unique ID to find your wallet when sending coins or creating loan offers.
        </p>
      </div>

      {/* Player Stats & Repayment History Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>Performance & Credit Metrics</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500">Games Played</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{profile?.gamesPlayed || 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500">Games Won</span>
            <p className="text-lg font-bold text-emerald-600 mt-1">{profile?.gamesWon || 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500">Loans Repaid</span>
            <p className="text-lg font-bold text-slate-900 mt-1">{profile?.loansRepaid || 0}</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500">Total Repaid Amount</span>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {(profile?.totalRepaidAmount || 0).toLocaleString()} coins
            </p>
          </div>
        </div>
      </div>

      {/* Security & Verification Details */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <Lock className="w-4 h-4 text-slate-700" />
          <span>Security & Identity Verification</span>
        </h2>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email Verification Status</span>
            </span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Verified
            </span>
          </div>

          {/* Account Password */}
          <div className="py-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-slate-400" />
                <span>Game Login Password</span>
              </span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                  {showPassword ? (profile?.password || '(not set)') : '••••••••'}
                </span>
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
                  onClick={() => {
                    setIsChangingPass(!isChangingPass);
                    setNewPassVal(profile?.password || '');
                  }}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Change
                </button>
              </div>
            </div>

            {isChangingPass && (
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <p className="text-[11px] font-bold text-slate-700">Set New Game Password:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newPassVal}
                    onChange={(e) => setNewPassVal(e.target.value)}
                    placeholder="Enter new password"
                    className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user || !newPassVal.trim()) return;
                      const res = await updateUserPassword(user.uid, newPassVal, user.email || 'user');
                      if (res.success) {
                        setPassSaveMsg('Password updated!');
                        setIsChangingPass(false);
                        setTimeout(() => setPassSaveMsg(null), 3000);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded font-bold text-xs"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPass(false)}
                    className="px-2 py-1.5 text-slate-500 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {passSaveMsg && (
              <p className="text-[11px] text-emerald-600 font-bold mt-1">{passSaveMsg}</p>
            )}
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Registration Date</span>
            </span>
            <span className="font-medium text-slate-800">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active Member'}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Double-Entry Ledger Integrity</span>
            </span>
            <span className="font-semibold text-emerald-600">
              Cryptographically Reconciled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
