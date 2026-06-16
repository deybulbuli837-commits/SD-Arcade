'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getRomLocally } from '../../lib/db';
import api from '../../lib/axios';
import { X, Maximize, RotateCcw } from 'lucide-react';
import { Nostalgist } from 'nostalgist';
import VirtualController from '../../components/VirtualController';

function EmulatorView() {
  const searchParams = useSearchParams();
  const hash = searchParams.get('hash');
  const router = useRouter();
  
  const [error, setError] = useState('');
  const [isPortrait, setIsPortrait] = useState(false);
  const [nostalgistInst, setNostalgistInst] = useState(null);
  const [platform, setPlatform] = useState(null);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const startTimeRef = useRef(0);
  const initLocked = useRef(false);

  useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    if (!hash) {
      setError('No ROM hash provided.');
      return;
    }

    if (initLocked.current) return;
    initLocked.current = true;

    startTimeRef.current = Date.now();
    let blobUrl = null;
    let nInst = null;

    const launchEmulator = async () => {
      try {
        const blob = await getRomLocally(hash);
        if (!blob) {
          setError('ROM not found locally. Please return to the dashboard and re-upload.');
          return;
        }

        const res = await api.get('/roms');
        const metadata = res.data.find((r) => r.romHash === hash);
        
        if (!metadata) {
          setError('ROM metadata not found.');
          return;
        }

        setPlatform(metadata.platform);

        let core = 'fceumm'; // NES
        if (metadata.platform === 'SNES') core = 'snes9x';
        if (metadata.platform === 'GBA') core = 'mgba';
        if (metadata.platform === 'Genesis') core = 'genesis_plus_gx';

        blobUrl = URL.createObjectURL(blob);

        nInst = await Nostalgist.launch({
          core: core,
          rom: blobUrl,
          element: canvasRef.current,
        });

        setNostalgistInst(nInst);

      } catch (err) {
        console.error(err);
        setError('Failed to launch emulator core.');
      }
    };

    launchEmulator();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (nInst) nInst.exit();
      
      const playTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (playTimeSeconds > 5) {
        api.put(`/roms/${hash}/play`, { playTime: playTimeSeconds }).catch(console.error);
      }
    };
  }, [hash]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const handleExit = async () => {
    // Save playstats before hard-reloading
    try {
      const playTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (playTimeSeconds > 1) { // lowered from 5 to 1 to ensure it updates even for quick tests
        await api.put(`/roms/${hash}/play`, { playTime: playTimeSeconds });
      }
    } catch (e) {
      console.error('Failed to save play stats:', e);
    }
    // Hard reload ensures the WebAssembly worker and AudioContext are destroyed completely
    window.location.href = '/dashboard';
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md text-center">
          <p className="text-red-400 mb-6">{error}</p>
          <button onClick={handleExit} className="px-6 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black h-[100dvh] w-full overflow-hidden flex flex-col relative">
      {isPortrait && (
        <div className="absolute inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center text-center p-8 backdrop-blur-sm pointer-events-none">
          <RotateCcw className="w-16 h-16 text-[#00f3ff] mb-6 animate-spin-slow" />
          <h2 className="text-2xl font-bold mb-4 neon-text">Rotate Device</h2>
          <p className="text-gray-400">For the best experience, please rotate your device to landscape mode.</p>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-[60] flex justify-between items-center px-4 md:px-8 opacity-0 hover:opacity-100 transition-opacity">
        <button onClick={handleExit} className="p-2 bg-black/50 rounded-full text-white hover:text-red-400 hover:bg-black/80 transition-all flex items-center gap-2 pointer-events-auto">
          <X className="w-5 h-5" /> <span className="hidden md:inline font-bold">Exit</span>
        </button>
        <button onClick={toggleFullscreen} className="p-2 bg-black/50 rounded-full text-white hover:text-[#00f3ff] hover:bg-black/80 transition-all flex items-center gap-2 pointer-events-auto">
          <Maximize className="w-5 h-5" /> <span className="hidden md:inline font-bold">Fullscreen</span>
        </button>
      </div>

      <div ref={containerRef} className="flex-1 flex items-center justify-center w-full h-full relative p-2 md:p-4 overflow-hidden mt-8 md:mt-0">
        <div className="relative w-full max-w-[1000px] h-full max-h-[65vh] md:max-h-full mx-auto bg-black border border-white/10 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)]">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-contain bg-black pointer-events-none" 
            tabIndex="-1"
          />
        </div>

        <VirtualController nostalgist={nostalgistInst} platform={platform} />
      </div>
    </div>
  );
}

export default function EmulatorPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center neon-text text-xl animate-pulse">Initializing Interface...</div>}>
        <EmulatorView />
      </Suspense>
    </ProtectedRoute>
  );
}
