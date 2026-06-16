'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRoms, syncRom } from '../../features/romSlice';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navbar from '../../components/Navbar';
import { generateRomHash, detectPlatform } from '../../utils/romUtils';
import { saveRomLocally, checkRomExistsLocally } from '../../lib/db';
import { motion } from 'framer-motion';
import { Upload, Play, Clock, Monitor } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { roms, loading } = useSelector((state) => state.roms);
  const { user } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchRoms());
  }, [dispatch]);

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {roms.map(rom => (
                    <motion.div 
                      key={rom.romHash}
                      whileHover={{ scale: 1.02 }}
                      className="glass-card p-4 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="font-bold text-lg truncate" title={rom.gameTitle}>{rom.gameTitle}</h3>
                        <div className="flex gap-2 text-xs text-gray-400 mt-1 mb-4">
                          <span className="flex items-center gap-1"><Monitor className="w-3 h-3"/> {rom.platform}</span>
                          {rom.lastPlayedAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {new Date(rom.lastPlayedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handlePlay(rom.romHash)}
                          className="flex-1 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded-lg py-2 flex justify-center items-center gap-2 hover:bg-[#00f3ff]/40 transition-colors"
                        >
                          <Play className="w-4 h-4" /> Play
                        </button>
                        <Link href={`/game?hash=${rom.romHash}`} className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
                          Details
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
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
