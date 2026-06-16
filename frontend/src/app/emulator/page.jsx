'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getRomLocally } from '../../lib/db';
import api from '../../lib/axios';
import { X, Maximize, RotateCcw, Save, Trash2, Download, UploadCloud, Loader2, Settings } from 'lucide-react';
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
  
  // Save States state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState([]);
  const [isSavesLoading, setIsSavesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'load-1', 'save-2', etc.

  // Floating Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    try {
      const playTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (playTimeSeconds > 1) {
        await api.put(`/roms/${hash}/play`, { playTime: playTimeSeconds });
      }
    } catch (e) {
      console.error('Failed to save play stats:', e);
    }
    window.location.href = '/dashboard';
  };

  // --- SAVE STATES LOGIC ---
  const openSaveModal = async () => {
    if (!nostalgistInst) return;
    nostalgistInst.pause();
    setIsSaveModalOpen(true);
    setIsMenuOpen(false); // Close the floating menu when modal opens
    setIsSavesLoading(true);
    try {
      const { data } = await api.get(`/saves/${hash}`);
      setSaveSlots(data);
    } catch (e) {
      console.error('Failed to fetch saves', e);
    } finally {
      setIsSavesLoading(false);
    }
  };

  const closeSaveModal = () => {
    setIsSaveModalOpen(false);
    if (nostalgistInst) nostalgistInst.resume();
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const base64ToBlob = (base64) => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  };

  const handleSaveState = async (slot) => {
    if (!nostalgistInst) return;
    setActionLoading(`save-${slot}`);
    try {
      const stateObj = await nostalgistInst.saveState();
      const base64Data = await blobToBase64(stateObj.state);
      
      await api.post(`/saves/${hash}/${slot}`, { saveData: base64Data });
      
      // Refresh slots
      const { data } = await api.get(`/saves/${hash}`);
      setSaveSlots(data);
    } catch (e) {
      console.error('Save State Error:', e);
      alert('Failed to save state');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLoadState = async (slot) => {
    if (!nostalgistInst) return;
    setActionLoading(`load-${slot}`);
    try {
      const { data } = await api.get(`/saves/${hash}/${slot}`);
      const blob = base64ToBlob(data.saveData);
      
      // Resume the game loop BEFORE trying to load the state!
      closeSaveModal(); 
      
      // Give the emulator core a tiny ms to tick so it can process the load command
      setTimeout(async () => {
        try {
          await nostalgistInst.loadState(blob);
        } catch (loadErr) {
          console.error('Nostalgist Load Error:', loadErr);
          alert('Core failed to load state.');
        }
      }, 50);

    } catch (e) {
      console.error('Load State API Error:', e);
      alert('Failed to fetch load state');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteState = async (slot) => {
    if (!window.confirm('Are you sure you want to delete this save?')) return;
    setActionLoading(`delete-${slot}`);
    try {
      await api.delete(`/saves/${hash}/${slot}`);
      const { data } = await api.get(`/saves/${hash}`);
      setSaveSlots(data);
    } catch (e) {
      console.error('Delete State Error:', e);
      alert('Failed to delete state');
    } finally {
      setActionLoading(null);
    }
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

      {/* Save States Modal Overlay */}
      {isSaveModalOpen && (
        <div className="absolute inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 relative flex flex-col pointer-events-auto shadow-2xl border border-[#00f3ff]/30">
            <button onClick={closeSaveModal} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-black mb-6 text-[#00f3ff] flex items-center gap-2">
              <UploadCloud className="w-6 h-6" /> Cloud Saves
            </h2>
            
            <div className="space-y-4">
              {isSavesLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[#00f3ff]" /></div>
              ) : (
                [1, 2, 3].map(slotNum => {
                  const slotData = saveSlots.find(s => s.saveSlot === slotNum);
                  const isActioning = actionLoading?.includes(slotNum.toString());

                  return (
                    <div key={slotNum} className="flex flex-col sm:flex-row justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10 hover:border-[#00f3ff]/30 transition-colors gap-4">
                      <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-bold text-lg text-white">Slot {slotNum}</h3>
                        <p className="text-sm text-gray-400">
                          {slotData ? new Date(slotData.updatedAt).toLocaleString() : 'Empty Slot'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {slotData ? (
                          <>
                            <button 
                              disabled={isActioning}
                              onClick={() => handleLoadState(slotNum)} 
                              className="px-4 py-2 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded font-bold hover:bg-[#00f3ff]/40 transition-colors flex items-center gap-2"
                            >
                              {actionLoading === `load-${slotNum}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Load
                            </button>
                            <button 
                              disabled={isActioning}
                              onClick={() => handleSaveState(slotNum)} 
                              className="px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded font-bold hover:bg-purple-500/40 transition-colors flex items-center gap-2"
                            >
                              {actionLoading === `save-${slotNum}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Overwrite
                            </button>
                            <button 
                              disabled={isActioning}
                              onClick={() => handleDeleteState(slotNum)} 
                              className="p-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/40 transition-colors"
                            >
                              {actionLoading === `delete-${slotNum}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </>
                        ) : (
                          <button 
                            disabled={isActioning}
                            onClick={() => handleSaveState(slotNum)} 
                            className="px-6 py-2 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded font-bold hover:bg-[#00f3ff]/40 transition-colors flex items-center gap-2"
                          >
                            {actionLoading === `save-${slotNum}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Menu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] flex flex-col gap-3 items-center pointer-events-none">
        
        {/* Dropdown Options */}
        <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${isMenuOpen ? 'scale-100 opacity-100 pointer-events-auto translate-y-0' : 'scale-75 opacity-0 pointer-events-none translate-y-4'}`}>
          <button onClick={toggleFullscreen} className="p-3 md:p-4 bg-black/60 rounded-full text-white hover:text-[#00f3ff] hover:bg-black/90 transition-all shadow-lg backdrop-blur-md border border-white/10 group relative" title="Fullscreen">
            <Maximize className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          
          <button onClick={openSaveModal} className="p-3 md:p-4 bg-black/60 rounded-full text-[#00f3ff] hover:bg-black/90 transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)] backdrop-blur-md border border-[#00f3ff]/50 group relative" title="Save State">
            <Save className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          
          <button onClick={handleExit} className="p-3 md:p-4 bg-black/60 rounded-full text-white hover:text-red-400 hover:bg-black/90 transition-all shadow-lg backdrop-blur-md border border-white/10 group relative" title="Exit">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="p-3 md:p-4 bg-gray-800/80 rounded-full text-white hover:text-[#00f3ff] hover:bg-gray-900 transition-all pointer-events-auto shadow-2xl backdrop-blur-md border border-white/20 mt-1"
        >
          <Settings className={`w-6 h-6 md:w-8 md:h-8 transition-transform duration-300 ${isMenuOpen ? 'rotate-90 text-[#00f3ff]' : ''}`} />
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
