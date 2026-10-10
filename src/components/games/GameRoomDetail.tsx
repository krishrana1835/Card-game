import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  GameRoom,
  PlayerInRoom,
} from '../../types';
import {
  togglePlayerReady,
  startGame,
  placeBetAction,
  foldAction,
  showdownAction,
  hostDeclareWinner,
  requestPayoutWinnings,
  voteOnPayout,
  adminOrHostResolveDispute,
  borrowPotBankLoan,
  addAdditionalFundsToTable,
  resetRoomForNextPot,
  POT_BANK_LOAN_DEFAULT,
} from '../../services/gameService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Users,
  Coins,
  Clock,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  ShieldAlert,
  Flame,
  Award,
  ChevronRight,
  Copy,
  Check,
  PlusCircle,
  Landmark,
  RotateCcw,
} from 'lucide-react';

interface GameRoomDetailProps {
  roomId: string;
  onBack: () => void;
}

export const GameRoomDetail: React.FC<GameRoomDetailProps> = ({ roomId, onBack }) => {
  const { user, profile, wallet, isAdmin } = useAuth();
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [raiseAmount, setRaiseAmount] = useState<number>(100000);
  const [declaredWinner, setDeclaredWinner] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);

  // In-room Add Funds and Pot Bank Loan modals
  const [showAddFundsModal, setShowAddFundsModal] = useState<boolean>(false);
  const [addFundsAmount, setAddFundsAmount] = useState<number>(500000);
  const [showPotLoanModal, setShowPotLoanModal] = useState<boolean>(false);
  const [potLoanAmount, setPotLoanAmount] = useState<number>(1000000);

  // Listen to room document in real-time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as GameRoom;
        setRoom(data);
        if (data.minBet && raiseAmount < data.minBet) {
          setRaiseAmount(data.minBet);
        }
      } else {
        setRoom(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [roomId]);

  // Turn timer countdown
  useEffect(() => {
    if (!room || room.status !== 'active' || !room.turnDeadline) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((room.turnDeadline! - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 500);

    return () => clearInterval(interval);
  }, [room?.turnDeadline, room?.status]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Connecting to game room live state...</div>;
  }

  if (!room) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
        <p className="text-sm text-slate-600">Game room not found or closed.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          Return to Game Rooms
        </button>
      </div>
    );
  }

  const isHost = user?.uid === room.hostId;
  const currentPlayer = room.players.find((p) => p.userId === user?.uid);
  const isMyTurn = room.status === 'active' && room.currentTurnPlayerId === user?.uid;
  const activeUnfolded = room.players.filter((p) => !p.folded);
  const isWinner = room.winnerId === user?.uid;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleToggleReady = async () => {
    if (!user) return;
    setActionError(null);
    const res = await togglePlayerReady(room.id, user.uid);
    if (!res.success) setActionError(res.error || 'Failed to toggle ready');
  };

  const handleStartGame = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await startGame(room.id, user.uid);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to start game');
  };

  const handleChaal = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await placeBetAction(room.id, user.uid, 'chaal');
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to chaal');
  };

  const handleRaise = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await placeBetAction(room.id, user.uid, 'raise', raiseAmount);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to raise');
  };

  const handleFold = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await foldAction(room.id, user.uid);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to pack/fold');
  };

  const handleShowdown = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await showdownAction(room.id, user.uid);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to request showdown');
  };

  const handleHostDeclare = async () => {
    if (!user || !declaredWinner) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await hostDeclareWinner(room.id, user.uid, declaredWinner);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to declare winner');
  };

  const handleRequestPayout = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await requestPayoutWinnings(room.id, user.uid);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to request payout');
  };

  const handleVote = async (decision: 'approve' | 'dispute') => {
    if (!user) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await voteOnPayout(room.id, user.uid, decision);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to vote');
  };

  const handleDisputeOverride = async (approved: boolean) => {
    if (!user) return;
    setIsSubmitting(true);
    const res = await adminOrHostResolveDispute(room.id, user.uid, approved);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to resolve dispute');
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !room) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await addAdditionalFundsToTable(room.id, user.uid, profile.username, addFundsAmount);
    setIsSubmitting(false);
    if (res.success) {
      setShowAddFundsModal(false);
    } else {
      setActionError(res.error || 'Failed to add funds from account');
    }
  };

  const handleBorrowPotLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !room) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await borrowPotBankLoan(room.id, user.uid, profile.username, potLoanAmount);
    setIsSubmitting(false);
    if (res.success) {
      setShowPotLoanModal(false);
    } else {
      setActionError(res.error || 'Failed to borrow pot bank loan');
    }
  };

  const handleResetNextPot = async () => {
    if (!room) return;
    setIsSubmitting(true);
    setActionError(null);
    const res = await resetRoomForNextPot(room.id);
    setIsSubmitting(false);
    if (!res.success) setActionError(res.error || 'Failed to start next pot');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Room Lobby</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Room Code:</span>
          <button
            onClick={handleCopyCode}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-bold px-2.5 py-1 rounded border border-slate-300"
          >
            <span>{room.roomCode}</span>
            {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Table / Game Arena Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold">{room.name}</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                {room.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Mode: {room.winnerMode.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Host: <span className="text-slate-200 font-medium">{room.hostName}</span> | Boot Entry: {room.bootAmount} coins | Min Bet: {room.minBet} coins
            </p>
          </div>

          {/* Central Escrow Pot Display & In-Room Bank Tools */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Escrow Pot */}
            <div className="flex items-center space-x-3 bg-slate-800/90 px-4 py-2.5 rounded-lg border border-slate-700">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Shared Escrow Pot</p>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span className="text-2xl font-black text-amber-400">
                    ₹{room.currentPot.toLocaleString()}
                  </span>
                </div>
              </div>

              {room.status === 'active' && (
                <div className="border-l border-slate-700 pl-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Current Call</p>
                  <p className="text-sm font-bold text-slate-200">₹{room.currentBet.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Pot Bank Loan Pool (₹50M per pot) */}
            <div className="bg-slate-800/90 border border-slate-700 px-3.5 py-2 rounded-lg text-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pot Bank Loan Pool</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{(room.potBankLoanPool !== undefined ? room.potBankLoanPool : POT_BANK_LOAN_DEFAULT).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">(Resets every pot)</span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowPotLoanModal(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded flex items-center space-x-1 shadow-xs transition-colors"
                >
                  <Landmark className="w-3 h-3" />
                  <span>Borrow Loan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddFundsModal(true)}
                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold rounded flex items-center space-x-1 transition-colors"
                >
                  <PlusCircle className="w-3 h-3 text-emerald-400" />
                  <span>Add Money</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Turn Status Alert in Active Mode */}
        {room.status === 'active' && (
          <div className={`px-5 py-3 border-b flex items-center justify-between ${
            isMyTurn ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center space-x-2 text-xs">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                {isMyTurn ? (
                  <strong className="text-amber-800">It is YOUR TURN to act!</strong>
                ) : (
                  <>
                    Current Turn:{' '}
                    <strong className="text-slate-900">
                      {room.players.find((p) => p.userId === room.currentTurnPlayerId)?.username || 'Waiting'}
                    </strong>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono font-bold">
              <span>Time Left: {timeLeft}s</span>
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${timeLeft < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (timeLeft / (room.turnDurationSec || 30)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Player Seats Grid */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Players at Table ({room.players.length} / {room.maxPlayers})</span>
            </h2>
            <span className="text-xs text-slate-400">Cardless Betting Room Variant</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {room.players.map((p) => {
              const isTurn = room.currentTurnPlayerId === p.userId && room.status === 'active';
              const isMe = p.userId === user?.uid;

              return (
                <div
                  key={p.userId}
                  className={`border rounded-xl p-4 transition-all relative ${
                    isTurn
                      ? 'border-2 border-amber-500 bg-amber-50/30 ring-2 ring-amber-400/20 shadow-xs'
                      : p.folded
                      ? 'border-slate-200 bg-slate-50/50 opacity-60'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                        {p.seatNumber}
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                            {p.username}
                          </span>
                          {isMe && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded font-semibold">
                              You
                            </span>
                          )}
                          {p.userId === room.hostId && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1 rounded font-semibold">
                              Host
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Contributed: {p.totalContributed.toLocaleString()} coins
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {room.status === 'waiting' && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            p.ready
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.ready ? 'Ready' : 'Not Ready'}
                        </span>
                      )}
                      {room.status === 'active' && (
                        p.folded ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                            Packed / Folded
                          </span>
                        ) : isTurn ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 animate-pulse">
                            Thinking...
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            In Game
                          </span>
                        )
                      )}
                      {(room.status === 'payout_pending' || room.status === 'completed') && (
                        p.userId === room.winnerId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center space-x-1">
                            <Trophy className="w-3 h-3 text-amber-600" />
                            <span>Winner</span>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 7: Winnings and Payout Approval Workflow Box */}
        {(room.status === 'payout_pending' || room.status === 'completed') && (
          <div className="border-t border-slate-200 bg-slate-50 p-5">
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Round Finished - Winner: {room.winnerName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total Pot: {room.currentPot.toLocaleString()} coins. Payout requires participant consensus.
                  </p>
                </div>
              </div>

              {/* State 1: Winner has not clicked Receive Winnings yet */}
              {!room.payoutRequest && isWinner && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-3">
                  <p className="text-xs text-emerald-800 font-medium">
                    Congratulations! Click below to initiate the payout approval request for your winnings.
                  </p>
                  <button
                    onClick={handleRequestPayout}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    Receive Winnings ({room.currentPot.toLocaleString()} coins)
                  </button>
                </div>
              )}

              {!room.payoutRequest && !isWinner && (
                <div className="p-4 bg-slate-100 rounded-lg text-center text-xs text-slate-600">
                  Waiting for {room.winnerName} to initiate the "Receive Winnings" payout request.
                </div>
              )}

              {/* State 2: Payout Request Active and Voting in Progress */}
              {room.payoutRequest && room.payoutRequest.status === 'pending' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                    <p className="font-semibold">Payout Approval Workflow Active</p>
                    <p className="mt-1 text-slate-600">
                      Non-winning players must approve the payout before the escrow pot of {room.currentPot.toLocaleString()} coins is released to {room.winnerName}.
                    </p>
                  </div>

                  {/* Real-time Vote Tracker */}
                  <div className="border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>Approval Progress:</span>
                      <span>
                        {Object.values(room.payoutRequest.votes).filter((v) => v === 'approve').length} / {room.payoutRequest.threshold} Approvals
                      </span>
                    </div>

                    <div className="space-y-1">
                      {room.players
                        .filter((p) => p.userId !== room.winnerId)
                        .map((p) => {
                          const vote = room.payoutRequest?.votes[p.userId];
                          return (
                            <div key={p.userId} className="flex items-center justify-between text-slate-600">
                              <span>{p.username}</span>
                              <span className="font-medium">
                                {vote === 'approve' ? (
                                  <span className="text-emerald-600 flex items-center space-x-1">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Approved</span>
                                  </span>
                                ) : vote === 'dispute' ? (
                                  <span className="text-rose-600 flex items-center space-x-1">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Disputed</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Pending vote...</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Non-winning Player Voting Buttons */}
                  {!isWinner && (
                    <div className="flex items-center justify-end space-x-3 pt-2">
                      <span className="text-xs text-slate-500">Your Vote:</span>
                      <button
                        onClick={() => handleVote('approve')}
                        disabled={isSubmitting || room.payoutRequest.votes[user?.uid || ''] === 'approve'}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve Payout</span>
                      </button>
                      <button
                        onClick={() => handleVote('dispute')}
                        disabled={isSubmitting || room.payoutRequest.votes[user?.uid || ''] === 'dispute'}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Dispute Payout</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* State 3: Disputed State */}
              {room.payoutRequest && room.payoutRequest.status === 'disputed' && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-800 text-xs font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Payout Disputed</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    A participant disputed this payout. Escrow pot is on hold until host or administrator review.
                  </p>

                  {(isHost || isAdmin) && (
                    <div className="pt-2 flex items-center space-x-3">
                      <span className="text-xs font-semibold text-slate-700">Host / Admin Resolution:</span>
                      <button
                        onClick={() => handleDisputeOverride(true)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded"
                      >
                        Override & Settle Pot to Winner
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* State 4: Completed & Settled */}
              {room.status === 'completed' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 text-center space-y-3">
                  <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-emerald-950">Pot Payout Approved & Credited to Personal Account</p>
                    <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                      ₹{room.currentPot.toLocaleString()} has been transferred directly into <strong>{room.winnerName}</strong>'s main account balance (not held in the room) and recorded in the double-entry ledger.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleResetNextPot}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-2 mx-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Start Next Pot (Resets ₹50,000,000 Bank Loan)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Waiting Mode Controls */}
          {room.status === 'waiting' && (
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleReady}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                    currentPlayer?.ready
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {currentPlayer?.ready ? '✓ You are Ready' : 'Click to Ready Up'}
                </button>
                <span className="text-xs text-slate-500">
                  {room.players.filter((p) => p.ready).length} / {room.players.length} players ready
                </span>
              </div>

              {isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={
                    isSubmitting ||
                    room.players.length < room.minPlayers ||
                    room.players.some((p) => !p.ready)
                  }
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                >
                  Start Game (Boot {room.bootAmount} coins each)
                </button>
              )}
            </div>
          )}

          {/* Active Mode Betting Controls */}
          {room.status === 'active' && (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span>Available to Bet: </span>
                <span className="font-bold text-emerald-600">
                  {wallet?.availableBalance.toLocaleString() ?? 0} coins
                </span>
              </div>

              {isMyTurn ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleChaal}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                  >
                    Chaal / Call ({room.currentBet} coins)
                  </button>

                  <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg p-1">
                    <input
                      type="number"
                      min={room.minBet}
                      max={room.maxBet || 2000}
                      step={10}
                      value={raiseAmount}
                      onChange={(e) => setRaiseAmount(Math.max(1, Number(e.target.value)))}
                      className="w-20 px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-slate-800"
                    />
                    <button
                      onClick={handleRaise}
                      disabled={isSubmitting}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded shadow-xs"
                    >
                      Raise (+{raiseAmount})
                    </button>
                  </div>

                  {activeUnfolded.length === 2 && (
                    <button
                      onClick={handleShowdown}
                      disabled={isSubmitting}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      Showdown
                    </button>
                  )}

                  <button
                    onClick={handleFold}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs"
                  >
                    Pack / Fold
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  {currentPlayer?.folded ? 'You folded this round. Waiting for resolution.' : 'Waiting for current player move...'}
                </div>
              )}
            </div>
          )}

          {/* Host Declaration Controls if winnerMode is host_declared and in payout_pending */}
          {room.status === 'payout_pending' && room.winnerMode === 'host_declared' && isHost && !room.winnerId && (
            <div className="flex items-center space-x-2 w-full justify-end">
              <span className="text-xs font-semibold text-slate-700">Declare Winner:</span>
              <select
                value={declaredWinner}
                onChange={(e) => setDeclaredWinner(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1"
              >
                <option value="">Select Player...</option>
                {room.players.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleHostDeclare}
                disabled={!declaredWinner || isSubmitting}
                className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded"
              >
                Confirm Winner
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Game Action Log Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Room Event Audit Log
        </h3>
        <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs text-slate-600">
          {(room.history || []).slice(-10).reverse().map((h) => (
            <div key={h.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
              <div>
                <span className="font-semibold text-slate-800">{h.username}</span>{' '}
                <span className="capitalize">{h.action}</span>
                {h.amount ? <span className="font-bold text-slate-900"> ({h.amount} coins)</span> : ''}
              </div>
              <span className="text-[10px] text-slate-400">
                {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal 1: Add Money from Account to Table */}
      {showAddFundsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Money from Account</h3>
                <p className="text-xs text-slate-500">Allocate additional funds from your account balance to the table</p>
              </div>
              <button onClick={() => setShowAddFundsModal(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleAddFunds} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount to Add (₹)</label>
                <input
                  type="number"
                  min={10000}
                  max={wallet?.availableBalance || 10000000}
                  step={50000}
                  required
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Available in your account: <strong className="text-emerald-600">₹{(wallet?.availableBalance || 0).toLocaleString()}</strong>
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFundsModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || addFundsAmount <= 0 || addFundsAmount > (wallet?.availableBalance || 0)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs"
                >
                  {isSubmitting ? 'Adding...' : 'Add Funds to Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Pot Bank Loan (₹50M Pool) */}
      {showPotLoanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pot Bank Loan (₹50,000,000 Pool)</h3>
                  <p className="text-xs text-slate-500">Bank loan allocation for this pot (resets every pot)</p>
                </div>
              </div>
              <button onClick={() => setShowPotLoanModal(false)} className="text-slate-400 font-bold">×</button>
            </div>

            <form onSubmit={handleBorrowPotLoan} className="space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-900 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Available Loan for this Pot:</span>
                  <span className="text-emerald-700">
                    ₹{(room.potBankLoanPool !== undefined ? room.potBankLoanPool : POT_BANK_LOAN_DEFAULT).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Each pot gets a fresh ₹50,000,000 loan reserve that resets every pot/round!
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Requested Loan Amount (₹)</label>
                <input
                  type="number"
                  min={100000}
                  max={room.potBankLoanPool !== undefined ? room.potBankLoanPool : POT_BANK_LOAN_DEFAULT}
                  step={100000}
                  required
                  value={potLoanAmount}
                  onChange={(e) => setPotLoanAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPotLoanModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    potLoanAmount <= 0 ||
                    potLoanAmount > (room.potBankLoanPool !== undefined ? room.potBankLoanPool : POT_BANK_LOAN_DEFAULT)
                  }
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-xs"
                >
                  {isSubmitting ? 'Borrowing...' : `Borrow ₹${potLoanAmount.toLocaleString()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
