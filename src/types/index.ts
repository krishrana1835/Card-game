export type UserRole = 'player' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  password?: string;
  accountStatus: AccountStatus;
  startingGrantClaimed: boolean;
  gamesPlayed: number;
  gamesWon: number;
  loansRepaid: number;
  totalRepaidAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Wallet {
  userId: string;
  username: string;
  availableBalance: number;
  lockedInGames: number;
  reservedInLoans: number;
  outstandingBankDebt: number;
  outstandingPrivateDebt: number;
  totalBalance: number;
  updatedAt: string;
}

export type LedgerAccountType =
  | 'player_wallet'
  | 'bank_reserves'
  | 'game_escrow_pot'
  | 'loan_receivables'
  | 'interest_income';

export type LedgerEntrySide = 'debit' | 'credit';

export interface LedgerEntry {
  accountType: LedgerAccountType;
  side: LedgerEntrySide;
  amount: number;
  ownerId?: string;
  notes?: string;
}

export type TransactionType =
  | 'grant'
  | 'transfer'
  | 'bet'
  | 'pot_win'
  | 'bank_borrow'
  | 'bank_repay'
  | 'bank_interest'
  | 'p2p_offer_reserve'
  | 'p2p_disburse'
  | 'p2p_repay'
  | 'p2p_interest'
  | 'p2p_refund'
  | 'admin_adjustment';

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';

export interface LedgerTransaction {
  id: string;
  transactionType: TransactionType;
  initiatorId: string;
  senderId?: string;
  recipientId?: string;
  amount: number;
  status: TransactionStatus;
  description: string;
  referenceId?: string;
  entries: LedgerEntry[];
  createdAt: string;
}

export type RoomVisibility = 'public' | 'private';
export type WinnerMode = 'server_rules' | 'host_declared' | 'player_voting';
export type RoomStatus = 'waiting' | 'active' | 'payout_pending' | 'completed';

export interface PlayerInRoom {
  userId: string;
  username: string;
  ready: boolean;
  folded: boolean;
  currentBet: number;
  totalContributed: number;
  seatNumber: number;
  inRoomFunds?: number; // funds brought to table from main account
}

export interface GameActionLog {
  id: string;
  userId: string;
  username: string;
  action: 'join' | 'ready' | 'boot' | 'chaal' | 'raise' | 'pack' | 'show' | 'win' | 'add_funds' | 'pot_loan';
  amount?: number;
  timestamp: string;
}

export interface PayoutRequest {
  id: string;
  winnerId: string;
  winnerName: string;
  pot: number;
  votes: Record<string, 'approve' | 'dispute'>;
  status: 'pending' | 'approved' | 'disputed';
  threshold: number;
  createdAt: string;
  deadline: string;
}

export interface GameRoom {
  id: string;
  roomCode: string;
  name: string;
  hostId: string;
  hostName: string;
  visibility: RoomVisibility;
  minPlayers: number;
  maxPlayers: number;
  bootAmount: number; // min 500,000 Rs
  minBet: number;
  maxBet: number;
  turnDurationSec: number;
  winnerMode: WinnerMode;
  status: RoomStatus;
  currentPot: number;
  currentBet: number;
  currentTurnPlayerId?: string;
  turnDeadline?: number;
  roundNumber?: number;
  potBankLoanPool: number; // 50,000,000 Rs per pot, resets every pot
  potBankLoansTaken?: Record<string, number>;
  players: PlayerInRoom[];
  winnerId?: string;
  winnerName?: string;
  payoutRequest?: PayoutRequest;
  history: GameActionLog[];
  createdAt: string;
  updatedAt: string;
}

export type LoanStatus = 'active' | 'paid' | 'defaulted';

export interface BankLoan {
  id: string;
  userId: string;
  username: string;
  principal: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  interestRate: number; // e.g., 12 for 12%
  intervalMinutes: number; // e.g. 2
  compound: boolean;
  status: LoanStatus;
  lastAccruedAt: string;
  nextAccrualAt: string;
  totalPaidInterest: number;
  totalPaidPrincipal: number;
  createdAt: string;
}

export type P2PLoanStatus = 'pending_offer' | 'active' | 'paid' | 'rejected' | 'cancelled';

export interface PrivateLoan {
  id: string;
  lenderId: string;
  lenderName: string;
  borrowerId: string;
  borrowerName: string;
  principal: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  interestRate: number; // percentage
  intervalMinutes: number;
  durationMinutes: number;
  compound: boolean;
  status: P2PLoanStatus;
  termsNote?: string;
  lastAccruedAt?: string;
  nextAccrualAt?: string;
  createdAt: string;
}

export type NotificationType = 'transfer' | 'game' | 'payout' | 'loan' | 'system';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface SystemConfig {
  startingGrant: number; // 10,000,000 Rs
  bankInterestRate: number; // in percent (default 12)
  bankIntervalMinutes: number; // in minutes (default 5)
  maxBankLoan: number; // default 50,000,000 Rs
  bankLoanPerPot: number; // 50,000,000 Rs per pot, resets every pot
  minBootAmount: number; // min 500,000 Rs
  maxTransfer: number; // default 50,000,000 Rs
  updatedBy?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  performedByEmail: string;
  details: Record<string, any>;
  createdAt: string;
}
