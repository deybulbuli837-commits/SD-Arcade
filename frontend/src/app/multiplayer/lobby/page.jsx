'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import api from '../../../lib/axios';
import { fetchRoms } from '../../../features/romSlice';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Navbar from '../../../components/Navbar';
import { Users, Send, Play, AlertCircle, LogOut, ArrowLeft } from 'lucide-react';
import { checkRomExistsLocally } from '../../../lib/db';

function LobbyView() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  const { roms } = useSelector(state => state.roms);
  
  const [room, setRoom] = useState(null);
  const roomRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isJoinerConnected, setIsJoinerConnected] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    dispatch(fetchRoms());
  }, [dispatch]);

  const fetchRoomData = async (updateConnectionStatus = true) => {
    try {
      const { data } = await api.get('/rooms');
      const currentRoom = data.find(r => r.roomId === roomId);
      if (!currentRoom) {
        router.push('/dashboard');
        return;
      }
      setRoom(currentRoom);
      roomRef.current = currentRoom;
      setMessages(currentRoom.messages || []);
      if (updateConnectionStatus) {
        setIsJoinerConnected(!!currentRoom.joinerId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoomData();
  }, [roomId, router]);

  useEffect(() => {
    if (!user || !roomId) return;

    const isProd = process.env.NODE_ENV === 'production';
    const newSocket = io(isProd ? undefined : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'));
    setSocket(newSocket);

    newSocket.emit('join_room_lobby', { roomId, userId: user._id, username: user.username });

    newSocket.on('user_joined_lobby', ({ userId }) => {
      setIsJoinerConnected(true);
      fetchRoomData(false); // Refetch to get the latest joiner name
    });

    newSocket.on('user_left_lobby', ({ userId }) => {
      if (roomRef.current && userId !== roomRef.current.hostId._id) {
        setIsJoinerConnected(false);
        fetchRoomData(false); // Refetch to clear joiner name if they left DB
      } else {
        setError('Host has disconnected.');
      }
    });

    newSocket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('host_started_game', async ({ romHash, platform }) => {
      // Joiner no longer needs the ROM locally because of WebRTC Streaming!
      router.push(`/emulator?hash=${romHash}&platform=${platform || ''}&multiplayer=true&roomId=${roomId}&role=${roomRef.current?.hostId._id === user._id ? 'host' : 'client'}`);
    });

    return () => newSocket.disconnect();
  }, [user, roomId, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('send_message', { 
      roomId, 
      senderId: user._id, 
      senderName: user.username, 
      text: chatInput.trim() 
    });
    setChatInput('');
  };

  const handleStartGame = (romHash, platform) => {
    if (!socket) return;
    socket.emit('start_game_request', { roomId, romHash, platform });
  };

  const handleLeave = async () => {
    if (room?.hostId._id === user._id) {
      await api.delete(`/rooms/${roomId}`);
    } else {
      await api.post(`/rooms/${roomId}/leave`);
    }
    router.push('/dashboard');
  };

  if (!room || !user) return <div className="text-white text-center mt-20">Loading lobby...</div>;

  const isHost = room.hostId._id === user._id;

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded mb-6 flex justify-between items-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5"/> {error}</div>
            <button onClick={() => setError('')} className="text-xl">&times;</button>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors" title="Back to Dashboard">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-black neon-text">Multiplayer Lobby</h1>
          </div>
          <button onClick={handleLeave} className="flex items-center gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 px-4 py-2 rounded font-bold transition-colors">
            <LogOut className="w-4 h-4"/> {isHost ? 'Delete Room' : 'Leave Room'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Player Status & Controls */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-xl font-bold mb-4 text-[#00f3ff] flex items-center gap-2"><Users className="w-5 h-5"/> Players</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-black/40 p-3 rounded border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Player 1 (Host)</p>
                    <p className="font-bold text-white">{room.hostId.username} {isHost && '(You)'}</p>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-3 rounded border border-white/10">
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Player 2 (Joiner)</p>
                    {room.joinerId ? (
                      <p className="font-bold text-white">{room.joinerId.username} {!isHost && '(You)'}</p>
                    ) : (
                      <p className="text-gray-500 italic">Waiting for player...</p>
                    )}
                  </div>
                  <div className={`w-3 h-3 rounded-full ${isJoinerConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                </div>
              </div>

              {isHost && !room.joinerId && (
                <div className="mt-6 text-center p-4 bg-[#bc13fe]/10 border border-[#bc13fe]/30 rounded">
                  <p className="text-xs text-[#bc13fe] font-bold uppercase mb-1">Invite Code</p>
                  <p className="text-3xl font-mono font-black text-white tracking-widest">{room.inviteCode}</p>
                </div>
              )}
            </div>

            {isHost && (
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4 text-[#bc13fe]">Select Game</h2>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {roms.map(r => (
                    <button 
                      key={r.romHash}
                      onClick={() => handleStartGame(r.romHash, r.platform)}
                      disabled={!isJoinerConnected}
                      className="w-full text-left bg-black/40 border border-white/10 hover:border-[#bc13fe] hover:bg-[#bc13fe]/10 p-3 rounded transition-colors disabled:opacity-50 flex justify-between items-center group"
                    >
                      <span className="font-bold text-sm truncate pr-2">{r.gameTitle}</span>
                      <Play className="w-4 h-4 text-gray-500 group-hover:text-[#bc13fe]" />
                    </button>
                  ))}
                  {roms.length === 0 && <p className="text-gray-500 text-sm">Upload ROMs in Dashboard first.</p>}
                </div>
                {!isJoinerConnected && <p className="text-xs text-yellow-500 mt-3 text-center">Wait for Player 2 to join before starting.</p>}
              </div>
            )}
          </div>

          {/* Chat Room */}
          <div className="md:col-span-2 glass-card p-6 flex flex-col h-[600px]">
            <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2">Room Chat</h2>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 custom-scrollbar pr-2">
              {messages.map((m, i) => {
                const isMe = m.senderId === user._id;
                return (
                  <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-gray-500 mb-1 px-1">{m.senderName}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${isMe ? 'bg-[#bc13fe] text-white rounded-br-none' : 'bg-gray-800 text-white border border-gray-700 rounded-bl-none'}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-black/50 border border-white/20 rounded-full px-4 py-2 text-white focus:outline-none focus:border-[#bc13fe]"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="bg-[#bc13fe] text-white p-2.5 rounded-full hover:bg-[#a010d8] transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">Loading...</div>}>
      <LobbyView />
    </Suspense>
  );
}
