import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { GameRoomsView } from './components/games/GameRoomsView';
import { SendMoneyView } from './components/transfer/SendMoneyView';
import { BankLoansView } from './components/loans/BankLoansView';
import { PrivateLendingView } from './components/loans/PrivateLendingView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { ProfileView } from './components/profile/ProfileView';
import { AdminPanelView } from './components/admin/AdminPanelView';
import { Shield, Coins, AlertCircle } from 'lucide-react';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
        <h2 className="text-sm font-bold text-slate-800">Connecting to Realtime Ledger...</h2>
        <p className="text-xs text-slate-500 mt-1">Initializing Firebase Authentication & Firestore state</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'game-rooms':
        return <GameRoomsView />;
      case 'send-money':
        return <SendMoneyView />;
      case 'bank-loans':
        return <BankLoansView />;
      case 'private-lending':
        return <PrivateLendingView />;
      case 'transactions':
        return <TransactionsView />;
      case 'notifications':
        return <NotificationsView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'profile':
        return <ProfileView />;
      case 'admin':
        return <AdminPanelView />;
      default:
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans antialiased">
      {/* Top Navigation */}
      <Navbar currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderContent()}
      </main>

      {/* Legal & Educational Disclaimer Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Teen Patti Virtual Banking & Multiplayer System</span>
          </div>

          <p className="text-[11px] text-center sm:text-right max-w-lg">
            <strong>Virtual Currency Only:</strong> This application is a game companion and virtual banking simulation. No real money deposits, withdrawals, payment gateways, or cash redemptions exist.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
