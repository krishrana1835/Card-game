import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  runTransaction,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  GameRoom,
  PlayerInRoom,
  WinnerMode,
  RoomVisibility,
  PayoutRequest,
  GameActionLog,
} from '../types';
import { lockBetCoins, settleGamePayout } from './ledgerService';
import { Wallet, LedgerEntry } from '../types';

export const POT_BANK_LOAN_DEFAULT = 50000000; // 50,000,000 Rs per pot loan pool
export const MIN_POT_BUY_IN = 1500000; // Minimum 1,500,000 Rs (15 Lakhs) pot stack required from account

export async function createGameRoom(
  hostId: string,
  hostName: string,
  name: string,
  visibility: RoomVisibility,
  minPlayers: number,
  maxPlayers: number,
  bootAmount: number,
  minBet: number,
  maxBet: number,
  turnDurationSec: number,
  winnerMode: WinnerMode,
  hostBuyInAmount?: number
): Promise<{ success: boolean; roomId?: string; error?: string }> {
  try {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomsCol = collection(db, 'game_rooms');
    const newRoomRef = doc(roomsCol);

    const effectiveBuyIn = Math.max(MIN_POT_BUY_IN, hostBuyInAmount || MIN_POT_BUY_IN);

    const initialPlayer: PlayerInRoom = {
      userId: hostId,
      username: hostName,
      ready: true,
      folded: false,
      currentBet: 0,
      totalContributed: 0,
      seatNumber: 1,
      inRoomFunds: 0,
      buyInAmount: effectiveBuyIn,
    };

    const initialHistory: GameActionLog[] = [
      {
        id: Math.random().toString(36).substring(7),
        userId: hostId,
        username: hostName,
        action: 'join',
        amount: effectiveBuyIn,
        timestamp: new Date().toISOString(),
      },
    ];

    const roomData: Omit<GameRoom, 'id'> = {
      roomCode,
      name,
      hostId,
      hostName,
      visibility,
      minPlayers,
      maxPlayers,
      bootAmount: Math.max(500000, bootAmount), // Min 500,000 Rs
      minBet,
      maxBet,
      turnDurationSec,
      winnerMode,
      status: 'waiting',
      currentPot: 0,
      currentBet: Math.max(500000, bootAmount),
      potBankLoanPool: POT_BANK_LOAN_DEFAULT, // 50,000,000 Rs bank loan pool per pot
      potBankLoansTaken: {},
      players: [initialPlayer],
      history: initialHistory,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(newRoomRef, roomData);
    return { success: true, roomId: newRoomRef.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function joinGameRoom(
  roomId: string,
  userId: string,
  username: string,
  buyInAmount?: number
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);
  const walletRef = doc(db, 'wallets', userId);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const walletSnap = await tx.get(walletRef);

      if (!snap.exists()) throw new Error('Game room not found.');
      if (!walletSnap.exists()) throw new Error('User wallet not found.');

      const room = snap.data() as GameRoom;
      const wallet = walletSnap.data() as Wallet;

      if (room.status !== 'waiting') {
        throw new Error('Game already in progress or completed.');
      }

      if (room.players.some((p) => p.userId === userId)) {
        return { success: true }; // Already joined
      }

      if (room.players.length >= room.maxPlayers) {
        throw new Error('Room is currently full.');
      }

      const finalBuyIn = Math.max(MIN_POT_BUY_IN, buyInAmount || MIN_POT_BUY_IN);
      if (wallet.availableBalance < finalBuyIn) {
        throw new Error(
          `Insufficient available account balance. Minimum ₹${finalBuyIn.toLocaleString()} is required from your account to join this pot. Your available balance is ₹${wallet.availableBalance.toLocaleString()}.`
        );
      }

      const nextSeat = room.players.length + 1;
      const newPlayer: PlayerInRoom = {
        userId,
        username,
        ready: false,
        folded: false,
        currentBet: 0,
        totalContributed: 0,
        seatNumber: nextSeat,
        buyInAmount: finalBuyIn,
        inRoomFunds: 0,
      };

      const updatedPlayers = [...room.players, newPlayer];
      const newHistory: GameActionLog[] = [
        ...(room.history || []),
        {
          id: Math.random().toString(36).substring(7),
          userId,
          username,
          action: 'join',
          amount: finalBuyIn,
          timestamp: new Date().toISOString(),
        },
      ];

      tx.update(roomRef, {
        players: updatedPlayers,
        history: newHistory,
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePlayerBuyIn(
  roomId: string,
  userId: string,
  newAmount: number
): Promise<{ success: boolean; error?: string }> {
  if (newAmount < MIN_POT_BUY_IN) {
    return { success: false, error: `Minimum buy-in amount is ₹${MIN_POT_BUY_IN.toLocaleString()}.` };
  }
  const roomRef = doc(db, 'game_rooms', roomId);
  const walletRef = doc(db, 'wallets', userId);

  try {
    return await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      const walletSnap = await tx.get(walletRef);
      if (!roomSnap.exists()) throw new Error('Room not found');
      if (!walletSnap.exists()) throw new Error('Wallet not found');

      const room = roomSnap.data() as GameRoom;
      const wallet = walletSnap.data() as Wallet;

      if (room.status !== 'waiting') throw new Error('Cannot change buy-in while game is in progress');
      if (wallet.availableBalance < newAmount) {
        throw new Error(
          `Insufficient available balance (₹${wallet.availableBalance.toLocaleString()}) for ₹${newAmount.toLocaleString()}.`
        );
      }

      const updatedPlayers = room.players.map((p) =>
        p.userId === userId ? { ...p, buyInAmount: newAmount } : p
      );

      tx.update(roomRef, {
        players: updatedPlayers,
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function togglePlayerReady(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('Game room not found.');
      const room = snap.data() as GameRoom;

      if (room.status !== 'waiting') return;

      const updatedPlayers = room.players.map((p) =>
        p.userId === userId ? { ...p, ready: !p.ready } : p
      );

      tx.update(roomRef, {
        players: updatedPlayers,
        updatedAt: new Date().toISOString(),
      });
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function startGame(roomId: string, hostId: string): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.hostId !== hostId) return { success: false, error: 'Only the host can start the game' };
    if (room.players.length < room.minPlayers) {
      return { success: false, error: `Need at least ${room.minPlayers} players to start.` };
    }

    const unready = room.players.filter((p) => !p.ready);
    if (unready.length > 0) {
      return { success: false, error: `Waiting for all players to be ready (${unready.map((u) => u.username).join(', ')})` };
    }

    // Automatically debit the committed table amount (minimum 1,500,000 Rs) from all players
    for (const player of room.players) {
      const debitAmount = Math.max(MIN_POT_BUY_IN, player.buyInAmount || MIN_POT_BUY_IN);
      const lockRes = await lockBetCoins(
        player.userId,
        player.username,
        roomId,
        room.name,
        debitAmount,
        'boot'
      );
      if (!lockRes.success) {
        return {
          success: false,
          error: `${player.username} has insufficient available balance (needs ₹${debitAmount.toLocaleString()} to start game).`,
        };
      }
    }

    const pot = room.players.reduce(
      (sum, p) => sum + Math.max(MIN_POT_BUY_IN, p.buyInAmount || MIN_POT_BUY_IN),
      0
    );
    const now = Date.now();
    const deadline = now + (room.turnDurationSec || 30) * 1000;
    const baseBet = room.bootAmount || 500000;

    const updatedPlayers = room.players.map((p) => {
      const debitAmount = Math.max(MIN_POT_BUY_IN, p.buyInAmount || MIN_POT_BUY_IN);
      return {
        ...p,
        folded: false,
        currentBet: baseBet,
        totalContributed: debitAmount,
      };
    });

    const firstPlayer = updatedPlayers[0];

    const history: GameActionLog[] = [
      ...(room.history || []),
      {
        id: Math.random().toString(36).substring(7),
        userId: 'system',
        username: 'System',
        action: 'boot',
        amount: pot,
        timestamp: new Date().toISOString(),
      },
    ];

    await updateDoc(roomRef, {
      status: 'active',
      currentPot: pot,
      currentBet: baseBet,
      currentTurnPlayerId: firstPlayer.userId,
      turnDeadline: deadline,
      roundNumber: room.roundNumber || 1,
      showdownPending: false,
      showdownCallerId: undefined,
      showdownCallerName: undefined,
      winnerId: undefined,
      winnerName: undefined,
      payoutRequest: undefined,
      players: updatedPlayers,
      history,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function getNextActivePlayer(players: PlayerInRoom[], currentUserId: string): PlayerInRoom | null {
  const activePlayers = players.filter((p) => !p.folded);
  if (activePlayers.length <= 1) return null;

  const currentIndex = players.findIndex((p) => p.userId === currentUserId);
  for (let i = 1; i < players.length; i++) {
    const nextIndex = (currentIndex + i) % players.length;
    const candidate = players[nextIndex];
    if (!candidate.folded) return candidate;
  }
  return null;
}

export async function placeBetAction(
  roomId: string,
  userId: string,
  action: 'chaal' | 'raise',
  raiseAmount?: number
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.status !== 'active') return { success: false, error: 'Game is not active' };
    if (room.currentTurnPlayerId !== userId) return { success: false, error: 'Not your turn!' };

    const player = room.players.find((p) => p.userId === userId);
    if (!player || player.folded) return { success: false, error: 'Player folded or not found' };

    let betContribution = room.currentBet;
    let newRoomCurrentBet = room.currentBet;

    if (action === 'raise') {
      const addedRaise = raiseAmount || room.minBet;
      newRoomCurrentBet = room.currentBet + addedRaise;
      if (room.maxBet && newRoomCurrentBet > room.maxBet) {
        return { success: false, error: `Maximum allowable bet is ${room.maxBet} coins.` };
      }
      betContribution = newRoomCurrentBet;
    }

    // Lock coins
    const lockRes = await lockBetCoins(
      userId,
      player.username,
      roomId,
      room.name,
      betContribution,
      action
    );
    if (!lockRes.success) {
      return { success: false, error: lockRes.error || 'Failed to lock bet coins' };
    }

    const nextPlayer = getNextActivePlayer(room.players, userId);
    const now = Date.now();
    const deadline = now + (room.turnDurationSec || 30) * 1000;

    const updatedPlayers = room.players.map((p) =>
      p.userId === userId
        ? {
            ...p,
            currentBet: newRoomCurrentBet,
            totalContributed: p.totalContributed + betContribution,
          }
        : p
    );

    const newPot = room.currentPot + betContribution;

    const actionLog: GameActionLog = {
      id: Math.random().toString(36).substring(7),
      userId,
      username: player.username,
      action,
      amount: betContribution,
      timestamp: new Date().toISOString(),
    };

    await updateDoc(roomRef, {
      currentPot: newPot,
      currentBet: newRoomCurrentBet,
      currentTurnPlayerId: nextPlayer ? nextPlayer.userId : userId,
      turnDeadline: deadline,
      players: updatedPlayers,
      history: [...(room.history || []), actionLog],
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function foldAction(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.status !== 'active') return { success: false, error: 'Game not active' };

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not in room' };

    const updatedPlayers = room.players.map((p) =>
      p.userId === userId ? { ...p, folded: true } : p
    );

    const remainingActive = updatedPlayers.filter((p) => !p.folded);

    const actionLog: GameActionLog = {
      id: Math.random().toString(36).substring(7),
      userId,
      username: player.username,
      action: 'pack',
      timestamp: new Date().toISOString(),
    };

    if (remainingActive.length === 1) {
      // Sole survivor wins immediately!
      const soleWinner = remainingActive[0];
      await updateDoc(roomRef, {
        players: updatedPlayers,
        status: 'payout_pending',
        winnerId: soleWinner.userId,
        winnerName: soleWinner.username,
        history: [
          ...(room.history || []),
          actionLog,
          {
            id: Math.random().toString(36).substring(7),
            userId: soleWinner.userId,
            username: soleWinner.username,
            action: 'win',
            amount: room.currentPot,
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    }

    const nextPlayer = getNextActivePlayer(updatedPlayers, userId);
    const now = Date.now();
    const deadline = now + (room.turnDurationSec || 30) * 1000;

    await updateDoc(roomRef, {
      players: updatedPlayers,
      currentTurnPlayerId: nextPlayer ? nextPlayer.userId : undefined,
      turnDeadline: deadline,
      history: [...(room.history || []), actionLog],
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function showdownAction(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.status !== 'active') return { success: false, error: 'Game is not currently active' };

    const activePlayers = room.players.filter((p) => !p.folded);
    if (activePlayers.length < 2) return { success: false, error: 'Showdown requires at least 2 active players' };

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not found in room' };

    // Debit money equal to the current chaal being made
    const showChaal = room.currentBet || room.bootAmount || 500000;
    const lockRes = await lockBetCoins(
      userId,
      player.username,
      roomId,
      room.name,
      showChaal,
      'show'
    );
    if (!lockRes.success) {
      return {
        success: false,
        error: lockRes.error || `Insufficient available balance to pay show chaal (₹${showChaal.toLocaleString()}).`,
      };
    }

    const newPot = room.currentPot + showChaal;

    const updatedPlayers = room.players.map((p) =>
      p.userId === userId
        ? {
            ...p,
            currentBet: showChaal,
            totalContributed: p.totalContributed + showChaal,
          }
        : p
    );

    const actionLog: GameActionLog = {
      id: Math.random().toString(36).substring(7),
      userId,
      username: player.username,
      action: 'show',
      amount: showChaal,
      timestamp: new Date().toISOString(),
    };

    // Do NOT decide the winner automatically - Host will decide between the last 2 remaining players
    await updateDoc(roomRef, {
      status: 'payout_pending',
      showdownPending: true,
      showdownCallerId: userId,
      showdownCallerName: player.username,
      winnerId: undefined,
      winnerName: undefined,
      currentPot: newPot,
      players: updatedPlayers,
      history: [...(room.history || []), actionLog],
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function hostDeclareWinner(
  roomId: string,
  hostId: string,
  declaredWinnerId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.hostId !== hostId) return { success: false, error: 'Only the host can declare the winner.' };

    const winner = room.players.find((p) => p.userId === declaredWinnerId);
    if (!winner) return { success: false, error: 'Player not found in room.' };

    await updateDoc(roomRef, {
      status: 'payout_pending',
      showdownPending: false,
      winnerId: winner.userId,
      winnerName: winner.username,
      history: [
        ...(room.history || []),
        {
          id: Math.random().toString(36).substring(7),
          userId: hostId,
          username: room.hostName,
          action: 'win',
          amount: room.currentPot,
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =================== PAYOUT APPROVAL WORKFLOW ===================

export async function requestPayoutWinnings(
  roomId: string,
  winnerId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (room.winnerId !== winnerId) {
      return { success: false, error: 'Only the designated winner can initiate payout claim.' };
    }

    if (room.payoutRequest && room.payoutRequest.status === 'approved') {
      return { success: false, error: 'Payout already settled.' };
    }

    // Eligible voters: non-winning participants
    const eligibleNonWinners = room.players.filter((p) => p.userId !== winnerId);
    const requiredVotes = eligibleNonWinners.length;

    // If no other players (rare single player test), auto approve
    if (requiredVotes === 0) {
      const settleRes = await settleGamePayout(
        roomId,
        room.name,
        winnerId,
        room.winnerName || 'Winner',
        room.currentPot,
        room.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          lockedAmount: p.totalContributed,
        }))
      );
      if (settleRes.success) {
        await updateDoc(roomRef, { status: 'completed' });
        return { success: true };
      }
      return { success: false, error: settleRes.error };
    }

    const payoutReq: PayoutRequest = {
      id: Math.random().toString(36).substring(7),
      winnerId,
      winnerName: room.winnerName || 'Winner',
      pot: room.currentPot,
      votes: {},
      status: 'pending',
      threshold: requiredVotes,
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    await updateDoc(roomRef, {
      payoutRequest: payoutReq,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function voteOnPayout(
  roomId: string,
  userId: string,
  decision: 'approve' | 'dispute'
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (!room.payoutRequest || room.payoutRequest.status !== 'pending') {
      return { success: false, error: 'No pending payout approval request.' };
    }

    if (room.winnerId === userId) {
      return { success: false, error: 'Winner cannot vote on their own payout.' };
    }

    const isParticipant = room.players.some((p) => p.userId === userId);
    if (!isParticipant) {
      return { success: false, error: 'Only participants in this game can vote.' };
    }

    const updatedVotes = {
      ...room.payoutRequest.votes,
      [userId]: decision,
    };

    const eligibleNonWinners = room.players.filter((p) => p.userId !== room.winnerId);
    const approveCount = Object.values(updatedVotes).filter((v) => v === 'approve').length;
    const disputeCount = Object.values(updatedVotes).filter((v) => v === 'dispute').length;

    let updatedStatus: 'pending' | 'approved' | 'disputed' = 'pending';

    if (disputeCount > 0) {
      updatedStatus = 'disputed';
    } else if (approveCount >= eligibleNonWinners.length) {
      updatedStatus = 'approved';
    }

    const updatedPayoutRequest: PayoutRequest = {
      ...room.payoutRequest,
      votes: updatedVotes,
      status: updatedStatus,
    };

    await updateDoc(roomRef, {
      payoutRequest: updatedPayoutRequest,
      updatedAt: new Date().toISOString(),
    });

    // If fully approved, settle payout immediately!
    if (updatedStatus === 'approved') {
      const settleRes = await settleGamePayout(
        roomId,
        room.name,
        room.winnerId!,
        room.winnerName || 'Winner',
        room.currentPot,
        room.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          lockedAmount: p.totalContributed,
        }))
      );

      if (!settleRes.success) {
        return { success: false, error: settleRes.error || 'Failed to settle pot ledger transaction.' };
      }

      await updateDoc(roomRef, {
        status: 'completed',
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function finalizeApprovedPayout(
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (!room.winnerId) return { success: false, error: 'No winner declared for this round' };

    const settleRes = await settleGamePayout(
      roomId,
      room.name,
      room.winnerId,
      room.winnerName || 'Winner',
      room.currentPot,
      room.players.map((p) => ({
        userId: p.userId,
        username: p.username,
        lockedAmount: p.totalContributed,
      }))
    );

    if (!settleRes.success) {
      return { success: false, error: settleRes.error };
    }

    await updateDoc(roomRef, {
      status: 'completed',
      payoutRequest: {
        ...(room.payoutRequest || {
          id: Math.random().toString(36).substring(7),
          winnerId: room.winnerId,
          winnerName: room.winnerName || 'Winner',
          pot: room.currentPot,
          votes: {},
          threshold: 0,
          createdAt: new Date().toISOString(),
          deadline: new Date().toISOString(),
        }),
        status: 'approved',
      },
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminOrHostResolveDispute(
  roomId: string,
  resolverId: string,
  approved: boolean
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    if (!room.payoutRequest) return { success: false, error: 'No payout request' };

    if (approved) {
      const settleRes = await settleGamePayout(
        roomId,
        room.name,
        room.winnerId!,
        room.winnerName || 'Winner',
        room.currentPot,
        room.players.map((p) => ({
          userId: p.userId,
          username: p.username,
          lockedAmount: p.totalContributed,
        }))
      );

      if (settleRes.success) {
        await updateDoc(roomRef, {
          status: 'completed',
          payoutRequest: {
            ...room.payoutRequest,
            status: 'approved',
          },
          updatedAt: new Date().toISOString(),
        });
        return { success: true };
      }
      return { success: false, error: settleRes.error };
    } else {
      // Dispute upheld, host/admin can reset or refund
      await updateDoc(roomRef, {
        payoutRequest: {
          ...room.payoutRequest,
          status: 'disputed',
        },
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function borrowPotBankLoan(
  roomId: string,
  userId: string,
  username: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Loan amount must be greater than 0.' };

  const roomRef = doc(db, 'game_rooms', roomId);
  const walletRef = doc(db, 'wallets', userId);
  const txColRef = collection(db, 'ledger_transactions');

  try {
    return await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      const walletSnap = await tx.get(walletRef);

      if (!roomSnap.exists()) throw new Error('Game room not found');
      if (!walletSnap.exists()) throw new Error('Wallet not found');

      const room = roomSnap.data() as GameRoom;
      const wallet = walletSnap.data() as Wallet;

      const availableLoanPool = room.potBankLoanPool !== undefined ? room.potBankLoanPool : POT_BANK_LOAN_DEFAULT;
      if (amount > availableLoanPool) {
        throw new Error(`Requested loan exceeds remaining pot bank loan pool of ₹${availableLoanPool.toLocaleString()}`);
      }

      const now = new Date().toISOString();
      const newPool = availableLoanPool - amount;
      const takenMap = { ...(room.potBankLoansTaken || {}) };
      takenMap[userId] = (takenMap[userId] || 0) + amount;

      // Update room
      const actionLog: GameActionLog = {
        id: Math.random().toString(36).substring(7),
        userId,
        username,
        action: 'pot_loan',
        amount,
        timestamp: now,
      };

      tx.update(roomRef, {
        potBankLoanPool: newPool,
        potBankLoansTaken: takenMap,
        history: [...(room.history || []), actionLog],
        updatedAt: now,
      });

      // Update wallet: credit available & total balance, record bank debt
      tx.update(walletRef, {
        availableBalance: Math.round((wallet.availableBalance + amount) * 100) / 100,
        totalBalance: Math.round((wallet.totalBalance + amount) * 100) / 100,
        outstandingBankDebt: Math.round((wallet.outstandingBankDebt + amount) * 100) / 100,
        updatedAt: now,
      });

      // Balanced ledger entries
      const entries: LedgerEntry[] = [
        {
          accountType: 'bank_reserves',
          side: 'debit',
          amount,
          notes: `Pot bank loan pool disbursed for room "${room.name}"`,
        },
        {
          accountType: 'player_wallet',
          side: 'credit',
          amount,
          ownerId: userId,
          notes: `Pot bank loan credited to player wallet`,
        },
        {
          accountType: 'loan_receivables',
          side: 'debit',
          amount,
          notes: `Pot loan liability tracked`,
        },
      ];

      const newTxRef = doc(txColRef);
      tx.set(newTxRef, {
        id: newTxRef.id,
        transactionType: 'bank_borrow',
        initiatorId: userId,
        recipientId: userId,
        referenceId: roomId,
        amount,
        status: 'completed',
        description: `Pot bank loan of ₹${amount.toLocaleString()} received during game "${room.name}"`,
        entries,
        createdAt: now,
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function addAdditionalFundsToTable(
  roomId: string,
  userId: string,
  username: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) return { success: false, error: 'Amount must be greater than 0.' };

  const roomRef = doc(db, 'game_rooms', roomId);
  const walletRef = doc(db, 'wallets', userId);

  try {
    return await runTransaction(db, async (tx) => {
      const roomSnap = await tx.get(roomRef);
      const walletSnap = await tx.get(walletRef);

      if (!roomSnap.exists()) throw new Error('Room not found');
      if (!walletSnap.exists()) throw new Error('Wallet not found');

      const room = roomSnap.data() as GameRoom;
      const wallet = walletSnap.data() as Wallet;

      if (wallet.availableBalance < amount) {
        throw new Error(`Insufficient available account balance. Available: ₹${wallet.availableBalance.toLocaleString()}`);
      }

      const now = new Date().toISOString();
      const updatedPlayers = room.players.map((p) =>
        p.userId === userId
          ? { ...p, inRoomFunds: (p.inRoomFunds || 0) + amount }
          : p
      );

      const actionLog: GameActionLog = {
        id: Math.random().toString(36).substring(7),
        userId,
        username,
        action: 'add_funds',
        amount,
        timestamp: now,
      };

      tx.update(roomRef, {
        players: updatedPlayers,
        history: [...(room.history || []), actionLog],
        updatedAt: now,
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetRoomForNextPot(
  roomId: string,
  userId?: string,
  username?: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, 'game_rooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return { success: false, error: 'Room not found' };
    const room = snap.data() as GameRoom;

    const resetPlayers = room.players.map((p) => ({
      ...p,
      ready: false,
      folded: false,
      currentBet: 0,
      totalContributed: 0,
      buyInAmount: Math.max(MIN_POT_BUY_IN, p.buyInAmount || MIN_POT_BUY_IN),
    }));

    const now = new Date().toISOString();
    const actionLog: GameActionLog = {
      id: Math.random().toString(36).substring(7),
      userId: userId || 'system',
      username: username || 'System',
      action: 'pot_continued',
      timestamp: now,
    };

    await updateDoc(roomRef, {
      status: 'waiting',
      currentPot: 0,
      currentBet: room.bootAmount || 500000,
      currentTurnPlayerId: undefined,
      turnDeadline: undefined,
      winnerId: undefined,
      winnerName: undefined,
      showdownPending: false,
      showdownCallerId: undefined,
      showdownCallerName: undefined,
      payoutRequest: undefined,
      potBankLoanPool: POT_BANK_LOAN_DEFAULT, // Resets to 50,000,000 Rs for every pot!
      potBankLoansTaken: {},
      players: resetPlayers,
      roundNumber: (room.roundNumber || 1) + 1,
      history: [...(room.history || []), actionLog],
      updatedAt: now,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
