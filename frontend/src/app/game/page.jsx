'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchRoms } from '../../features/romSlice';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navbar from '../../components/Navbar';
import { useRouter, useSearchParams } from 'next/navigation';
import { Play, Trash2, Clock, Calendar, Hash, Monitor, Activity } from 'lucide-react';
import { deleteRomLocally, checkRomExistsLocally } from '../../lib/db';
import api from '../../lib/axios';

function GameDetailsContent() {
  const searchParams = useSearchParams();
  const romHash = searchParams.get('hash');
  
  const dispatch = useDispatch();
  const router = useRouter();
  const { roms } = useSelector((state) => state.roms);
  
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (roms.length === 0) {
      dispatch(fetchRoms());
    }
  }, [dispatch, roms.length]);

  const rom = roms.find(r => r.romHash === romHash);

  if (!rom) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 text-center mt-20">
          <h2 className="text-2xl text-gray-400">Game not found or loading...</h2>
        </div>
      </ProtectedRoute>
    );
  }

  const handlePlay = async () => {
    const exists = await checkRomExistsLocally(rom.romHash);
    if (!exists) {
      setError('ROM missing on this device. Please re-upload to continue.');
      return;
    }
    router.push(`/emulator?hash=${rom.romHash}`);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to remove this game from your library?')) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/roms/${rom.romHash}`);
      await deleteRomLocally(rom.romHash);
      dispatch(fetchRoms());
      router.push('/dashboard');
    } catch (err) {
      setError('Failed to delete game.');
      setIsDeleting(false);
    }
  };

  return (
    <ProtectedRoute>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        <div className="glass-card p-8 neon-border relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#bc13fe]/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-10">
            <div>
              <button 
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-[#00f3ff] hover:text-white transition-colors mb-4 text-sm font-bold"
              >
                <Monitor className="w-4 h-4" /> &larr; Back to Arcade
              </button>
              <h1 className="text-4xl font-black neon-text mb-2">{rom.gameTitle}</h1>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-sm">
                <Monitor className="w-4 h-4" /> {rom.platform}
              </span>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={handlePlay}
                className="flex-1 md:flex-none px-8 py-3 bg-[#00f3ff] text-black font-bold rounded-lg hover:bg-white hover:text-black transition-colors shadow-[0_0_15px_rgba(0,243,255,0.4)] flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> Play
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-3 bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                title="Remove Game"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className="space-y-4">
              <h3 className="text-xl font-bold border-b border-white/10 pb-2">Statistics</h3>
              <div className="flex items-center gap-3 text-gray-300">
                <Activity className="w-5 h-5 text-[#00f3ff]" />
                <div>
                  <p className="text-sm text-gray-500">Launch Count</p>
                  <p className="font-medium text-white">{rom.launchCount} times</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Clock className="w-5 h-5 text-[#bc13fe]" />
                <div>
                  <p className="text-sm text-gray-500">Play Time</p>
                  <p className="font-medium text-white">{Math.floor(rom.playTime / 60)} minutes</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold border-b border-white/10 pb-2">Metadata</h3>
              <div className="flex items-center gap-3 text-gray-300">
                <Calendar className="w-5 h-5 text-[#00f3ff]" />
                <div>
                  <p className="text-sm text-gray-500">Last Played</p>
                  <p className="font-medium text-white">
                    {rom.lastPlayedAt ? new Date(rom.lastPlayedAt).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Hash className="w-5 h-5 text-[#bc13fe]" />
                <div className="overflow-hidden">
                  <p className="text-sm text-gray-500">SHA-256 Hash</p>
                  <p className="font-medium text-white text-xs truncate max-w-[200px]" title={rom.romHash}>
                    {rom.romHash}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function GameDetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><h2 className="text-[#00f3ff] animate-pulse">Loading Game Details...</h2></div>}>
      <GameDetailsContent />
    </Suspense>
  );
}
