'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRoms, syncRom } from '../../features/romSlice';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navbar from '../../components/Navbar';
import { generateRomHash, detectPlatform } from '../../utils/romUtils';
import { saveRomLocally, checkRomExistsLocally } from '../../lib/db';
import { motion } from 'framer-motion';
import { Upload, Play, Clock, Monitor, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '../../lib/axios';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { roms, loading } = useSelector((state) => state.roms);
  const { user } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  // Multiplayer State
  const [rooms, setRooms] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchRoms());
    fetchRooms();
  }, [dispatch]);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  };

  const handleCreateRoom = async () => {
    try {
      setRoomLoading(true);
      setRoomError('');
      await api.post('/rooms');
      await fetchRooms();
    } catch (e) {
      setRoomError(e.response?.data?.message || 'Failed to create room');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    try {
      setRoomLoading(true);
      setRoomError('');
      await api.post('/rooms/join', { inviteCode: joinCode.trim() });
      setJoinCode('');
      await fetchRooms();
    } catch (e) {
      setRoomError(e.response?.data?.message || 'Failed to join room');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    try {
      await api.delete(`/rooms/${roomId}`);
      await fetchRooms();
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const platform = detectPlatform(file.name);
    if (platform === 'Unknown') {
      setError('Unsupported file type. Please upload .nes, .sfc, .smc, or .gba files.');
      return;
    }

    try {
      setUploading(true);
      setError('');
      const romHash = await generateRomHash(file);
      
      // Save locally
      await saveRomLocally(romHash, file);

      // Sync metadata with backend
      const gameTitle = file.name.split('.').slice(0, -1).join('.');
      await dispatch(syncRom({ romHash, gameTitle, platform }));
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError('Failed to upload ROM.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handlePlay = async (romHash) => {
    const exists = await checkRomExistsLocally(romHash);
    if (!exists) {
      setError('ROM missing on this device. Please re-upload to continue.');
      return;
    }
    router.push(`/emulator?hash=${romHash}`);
  };

  const lastPlayedRom = user?.lastPlayedRomHash ? roms.find(r => r.romHash === user.lastPlayedRomHash) : null;
  const recentlyPlayed = [...roms].sort((a, b) => new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime()).slice(0, 3);

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded mb-8 flex justify-between items-center">
            {error}
            <button onClick={() => setError('')} className="text-xl leading-none">&times;</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Action Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Upload Section */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-8 border-dashed border-2 border-[#bc13fe]/50 hover:border-[#bc13fe] transition-colors cursor-pointer text-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-[#bc13fe]" />
              <h2 className="text-2xl font-bold mb-2">Upload ROM</h2>
              <p className="text-gray-400 mb-4">Supports .nes, .sfc, .smc, .gba</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".nes,.sfc,.smc,.gba" 
                onChange={handleFileUpload} 
              />
              {uploading && <p className="text-[#00f3ff] animate-pulse">Processing ROM...</p>}
            </motion.div>

            {/* My Library */}
            <div>
              <h2 className="text-2xl font-bold mb-4 neon-text">My Library</h2>
              {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl"></div>)}
                </div>
              ) : roms.length === 0 ? (
                <div className="glass-card p-8 text-center text-gray-400">
                  Your library is empty. Upload a ROM to start playing!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {roms.map(rom => {
                    // Procedural colors based on hash so each cartridge looks unique
                    const hashNum = parseInt(rom.romHash.substring(0, 8), 16);
                    const hue1 = hashNum % 360;
                    const hue2 = (hue1 + 40) % 360;
                    
                    return (
                      <motion.div 
                        key={rom.romHash}
                        whileHover={{ y: -5 }}
                        className="relative group perspective-1000"
                      >
                        {/* Cartridge Body */}
                        <div className="relative bg-gradient-to-b from-gray-700 to-gray-900 border-2 border-gray-600 rounded-t-lg rounded-b-sm p-3 pb-4 shadow-[0_10px_20px_rgba(0,0,0,0.5)] flex flex-col h-full transform transition-transform duration-300 group-hover:scale-[1.02]">
                          
                          {/* Top Ridge Textures */}
                          <div className="absolute top-0 left-0 right-0 h-4 flex justify-between px-4 opacity-30">
                            {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-full bg-black rounded-b-sm"></div>)}
                          </div>

                          {/* Cartridge Label Sticker */}
                          <div 
                            className="relative mt-4 flex-1 rounded shadow-inner p-1 overflow-hidden"
                            style={{ background: `linear-gradient(135deg, hsl(${hue1}, 80%, 30%), hsl(${hue2}, 80%, 20%))` }}
                          >
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')] opacity-20 mix-blend-overlay"></div>
                            
                            {/* Sticker Top Header */}
                            <div className="bg-black/40 text-white/70 text-[10px] uppercase font-black px-2 py-0.5 flex justify-between items-center rounded-t-sm">
                              <span className="neon-text text-white" style={{ textShadow: "1px 1px 0px #bc13fe, 2px 2px 0px #00f3ff" }}>SD-Arcade System</span>
                              <span>{rom.platform}</span>
                            </div>

                            {/* Game Title Area */}
                            <div className="flex-1 flex items-center justify-center p-4 text-center h-24">
                              <h3 
                                className="font-black text-xl leading-tight text-white drop-shadow-md"
                                style={{ textShadow: '2px 2px 0 #000' }}
                              >
                                {rom.gameTitle}
                              </h3>
                            </div>
                            
                            {/* Nintendo-style Seal of Quality Fake */}
                            <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full border border-yellow-500/50 flex items-center justify-center opacity-50">
                              <div className="w-5 h-5 rounded-full border border-yellow-500 flex items-center justify-center text-[5px] text-yellow-500 font-bold text-center leading-none">SEAL<br/>OK</div>
                            </div>
                          </div>

                          {/* Bottom Buttons Area */}
                          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-700/50">
                            <button 
                              onClick={() => handlePlay(rom.romHash)}
                              className="flex-1 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded py-2 flex justify-center items-center gap-2 hover:bg-[#00f3ff]/40 transition-colors text-sm font-bold whitespace-nowrap"
                            >
                              <Play className="w-4 h-4" /> Play
                            </button>
                            <Link 
                              href={`/game?hash=${rom.romHash}`} 
                              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded text-gray-300 hover:bg-gray-600 hover:text-white transition-colors text-sm font-bold whitespace-nowrap flex items-center justify-center"
                            >
                              Details
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            
            {/* Multiplayer Rooms */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 border border-[#bc13fe]/30">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-[#bc13fe]">
                <Users className="w-5 h-5" /> Multiplayer
              </h2>
              
              {roomError && <p className="text-red-400 text-xs mb-3">{roomError}</p>}

              {rooms.length > 0 && (
                <div className="space-y-3 mb-6">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Your Active Rooms</p>
                  {rooms.map(room => (
                    <div key={room.roomId} className="bg-black/40 border border-white/10 rounded-lg p-3 relative group">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-[#00f3ff]">Room: {room.roomId.substring(0,6)}</span>
                        {room.hostId._id === user._id && (
                          <button onClick={() => handleDeleteRoom(room.roomId)} className="text-red-500/50 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-gray-300 mb-3 space-y-1">
                        <p>Host: {room.hostId.username} {room.hostId._id === user._id && '(You)'}</p>
                        <p>Joiner: {room.joinerId ? room.joinerId.username : <span className="text-gray-500 italic">Waiting...</span>}</p>
                      </div>
                      <Link 
                        href={`/multiplayer/lobby?roomId=${room.roomId}`}
                        className="block w-full text-center py-2 bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/50 rounded text-sm font-bold hover:bg-[#bc13fe]/40 transition-colors"
                      >
                        Enter Lobby
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-white/10">
                <button 
                  onClick={handleCreateRoom}
                  disabled={roomLoading || rooms.some(r => r.hostId._id === user._id)}
                  className="w-full py-2.5 bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/50 rounded font-bold hover:bg-[#bc13fe]/40 transition-colors disabled:opacity-50"
                  title={rooms.some(r => r.hostId._id === user._id) ? "You already have an active room hosted." : ""}
                >
                  {roomLoading ? 'Creating...' : 'Host a Room'}
                </button>
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/10"></div>
                  <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-bold uppercase">or</span>
                  <div className="flex-grow border-t border-white/10"></div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Invite Code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f3ff] uppercase"
                    maxLength={6}
                  />
                  <button 
                    onClick={handleJoinRoom}
                    disabled={roomLoading || !joinCode.trim()}
                    className="px-4 py-2 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded font-bold hover:bg-[#00f3ff]/40 transition-colors disabled:opacity-50 text-sm"
                  >
                    Join
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Continue Playing */}
            {lastPlayedRom && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 neon-border relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f3ff]/10 rounded-full blur-3xl"></div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Play className="text-[#00f3ff]" /> Continue Playing
                </h2>
                <h3 className="text-2xl font-black mb-1 truncate" title={lastPlayedRom.gameTitle}>{lastPlayedRom.gameTitle}</h3>
                <p className="text-gray-400 mb-6">{lastPlayedRom.platform}</p>
                <button 
                  onClick={() => handlePlay(lastPlayedRom.romHash)}
                  className="w-full py-3 bg-[#bc13fe] text-white rounded-lg font-bold hover:bg-[#a00de0] transition-colors shadow-[0_0_15px_rgba(188,19,254,0.4)]"
                >
                  Resume
                </button>
              </motion.div>
            )}

            {/* Recently Played */}
            {recentlyPlayed.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-xl font-bold mb-4">Recently Played</h2>
                <div className="space-y-4">
                  {recentlyPlayed.map(rom => (
                    <div key={`recent-${rom.romHash}`} className="flex justify-between items-center group cursor-pointer" onClick={() => handlePlay(rom.romHash)}>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-white group-hover:text-[#00f3ff] transition-colors truncate">{rom.gameTitle}</p>
                        <p className="text-xs text-gray-400">{rom.platform}</p>
                      </div>
                      <Play className="w-4 h-4 text-gray-500 group-hover:text-[#00f3ff]" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
