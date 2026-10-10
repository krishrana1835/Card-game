import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  GameRoom,
  WinnerMode,
  RoomVisibility,
} from '../../types';
import { createGameRoom, joinGameRoom } from '../../services/gameService';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { GameRoomDetail } from './GameRoomDetail';
import {
  Gamepad2,
  PlusCircle,
  Users,
  Coins,
  Search,
  Lock,
  Globe,
  ArrowRight,
  ShieldAlert,
  PlayCircle,
  Trophy,
} from 'lucide-react';

export const GameRoomsView: React.FC = () => {
  const { user, profile, wallet } = useAuth();
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');

  // Create Room Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [roomName, setRoomName] = useState<string>('Royal Teen Patti Table');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [minPlayers, setMinPlayers] = useState<number>(2);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [bootAmount, setBootAmount] = useState<number>(500000); // Min starting amount for pot is 500,000 Rs
  const [minBet, setMinBet] = useState<number>(100000);
  const [maxBet, setMaxBet] = useState<number>(10000000);
  const [turnDurationSec, setTurnDurationSec] = useState<number>(30);
  const [winnerMode, setWinnerMode] = useState<WinnerMode>('server_rules');

  // Listen to all game rooms
  useEffect(() => {
    const q = query(collection(db, 'game_rooms'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const roomList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GameRoom[];
      setRooms(roomList);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (bootAmount > (wallet?.availableBalance || 0)) {
      setErrorMsg(`Boot amount (${bootAmount}) exceeds your available balance (${wallet?.availableBalance || 0}).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createGameRoom(
      user.uid,
      profile.username,
      roomName,
      visibility,
      minPlayers,
      maxPlayers,
      bootAmount,
      minBet,
      maxBet,
      turnDurationSec,
      winnerMode
    );

    setIsSubmitting(false);

    if (res.success && res.roomId) {
      setShowCreateModal(false);
      setActiveRoomId(res.roomId);
    } else {
      setErrorMsg(res.error || 'Failed to create game room.');
    }
  };

  const handleJoinByCode = async () => {
    if (!user || !profile || !joinCodeInput.trim()) return;
    const targetRoom = rooms.find(
      (r) => r.roomCode.toLowerCase() === joinCodeInput.trim().toLowerCase()
    );

    if (!targetRoom) {
      setErrorMsg('No room found with this invitation code.');
      return;
    }

    const res = await joinGameRoom(targetRoom.id, user.uid, profile.username);
    if (res.success) {
      setJoinCodeInput('');
      setActiveRoomId(targetRoom.id);
    } else {
      setErrorMsg(res.error || 'Failed to join room.');
    }
  };

  const handleJoinClick = async (room: GameRoom) => {
    if (!user || !profile) return;
    const isMember = room.players.some((p) => p.userId === user.uid);
    if (isMember) {
      setActiveRoomId(room.id);
      return;
    }

    const res = await joinGameRoom(room.id, user.uid, profile.username);
    if (res.success) {
      setActiveRoomId(room.id);
    } else {
      setErrorMsg(res.error || 'Failed to join room.');
    }
  };

  if (activeRoomId) {
    return <GameRoomDetail roomId={activeRoomId} onBack={() => setActiveRoomId(null)} />;
  }

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roomCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.hostName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900">Multiplayer Game Rooms</h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Teen Patti Cardless Variant
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multiplayer betting rooms with escrow pot custody, Chaal/Raise/Fold mechanics, and consensual payout approval.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Create New Room</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Join by Code & Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search room name or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Rooms (Any Status)</option>
            <option value="waiting">Waiting in Lobby</option>
            <option value="active">Active In-Game</option>
            <option value="payout_pending">Payout Approval Pending</option>
            <option value="completed">Completed Rounds</option>
          </select>
        </div>

        {/* Join by Code */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Enter Room Code (e.g. 7X9K2P)"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <button
            onClick={handleJoinByCode}
            disabled={!joinCodeInput.trim()}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shrink-0 transition-colors"
          >
            Join
          </button>
        </div>
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading active game rooms...</div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <Gamepad2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Game Rooms Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create a new room or use an invitation code to start a multiplayer Teen Patti betting table!
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg"
          >
            Create First Room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const isUserInRoom = room.players.some((p) => p.userId === user?.uid);
            const isFull = room.players.length >= room.maxPlayers;

            return (
              <div
                key={room.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 truncate max-w-[190px]">
                        {room.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Host: <span className="font-medium text-slate-700">{room.hostName}</span>
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        room.status === 'waiting'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : room.status === 'active'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : room.status === 'payout_pending'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {room.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Room Meta Badges */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">PLAYERS</span>
                      <span className="font-bold text-slate-800">
                        {room.players.length} / {room.maxPlayers}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">CURRENT POT</span>
                      <span className="font-bold text-amber-600">
                        {room.currentPot.toLocaleString()} coins
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">BOOT ENTRY</span>
                      <span className="font-medium text-slate-700">{room.bootAmount} coins</span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">WINNER MODE</span>
                      <span className="font-medium text-slate-700 capitalize">
                        {room.winnerMode.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-slate-500">
                    Code: {room.roomCode}
                  </span>

                  <button
                    onClick={() => handleJoinClick(room)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isUserInRoom
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : isFull
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>{isUserInRoom ? 'Resume Table' : isFull ? 'Table Full' : 'Join Table'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Create Game Room</h2>
                <p className="text-xs text-slate-500">Configure betting limits, turn duration and winner mode</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Room Name</label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as RoomVisibility)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="public">Public (Visible in Lobby)</option>
                    <option value="private">Private (Invitation Code Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Winner Determination Mode</label>
                  <select
                    value={winnerMode}
                    onChange={(e) => setWinnerMode(e.target.value as WinnerMode)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  >
                    <option value="server_rules">Server-Rules Showdown</option>
                    <option value="host_declared">Host-Declared Winner</option>
                    <option value="player_voting">Player Consensus Voting</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Players</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={minPlayers}
                    onChange={(e) => setMinPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Players</label>
                  <input
                    type="number"
                    min={minPlayers}
                    max={6}
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Boot Entry (Min ₹500,000)</label>
                  <input
                    type="number"
                    min={500000}
                    step={50000}
                    value={bootAmount}
                    onChange={(e) => setBootAmount(Math.max(500000, Number(e.target.value)))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min Bet (Chaal ₹)</label>
                  <input
                    type="number"
                    min={50000}
                    step={50000}
                    value={minBet}
                    onChange={(e) => setMinBet(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Bet (₹)</label>
                  <input
                    type="number"
                    min={minBet}
                    step={100000}
                    value={maxBet}
                    onChange={(e) => setMaxBet(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Turn Duration (Seconds)</label>
                <select
                  value={turnDurationSec}
                  onChange={(e) => setTurnDurationSec(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                >
                  <option value={15}>15 Seconds (Blitz)</option>
                  <option value={30}>30 Seconds (Standard)</option>
                  <option value={45}>45 Seconds</option>
                  <option value={60}>60 Seconds</option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-[11px] space-y-1">
                <p>• Boot entry of {bootAmount} coins is automatically escrowed from every player when game starts.</p>
                <p>• Payout is safeguarded: non-winning participants approve the payout before the pot is credited.</p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  {isSubmitting ? 'Creating Room...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
