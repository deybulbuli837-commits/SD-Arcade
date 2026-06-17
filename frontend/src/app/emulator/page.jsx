'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ProtectedRoute from '../../components/ProtectedRoute';
import { getRomLocally } from '../../lib/db';
import api from '../../lib/axios';
import { Save, UploadCloud, Download, Loader2, X, Settings, RotateCcw, Maximize, LogOut, Trash2 } from 'lucide-react';
import { getControllerConfig } from '@/utils/controllerConfig';
import { Nostalgist } from 'nostalgist';
import VirtualController from '../../components/VirtualController';
import { io } from 'socket.io-client';

function EmulatorView() {
  const searchParams = useSearchParams();
  const hash = searchParams.get('hash');
  const multiplayer = searchParams.get('multiplayer') === 'true';
  const roomId = searchParams.get('roomId');
  const role = searchParams.get('role');
  const router = useRouter();
  
  const [error, setError] = useState('');
  const [isPortrait, setIsPortrait] = useState(false);
  const [nostalgistInst, setNostalgistInst] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [socket, setSocket] = useState(null);
  
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
  const nostalgistRef = useRef(null); // Need ref for socket callbacks
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const [webrtcStatus, setWebrtcStatus] = useState('');

  useEffect(() => {
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    if (!hash && role !== 'client') {
      setError('No ROM hash provided.');
      return;
    }

    if (initLocked.current) return;
    initLocked.current = true;

    // Monkey-patch AudioContext and AudioNode to reliably capture emulator audio for WebRTC
    if (!window.__audioPatched && role === 'host' && multiplayer) {
      window.__audioPatched = true;
      
      const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
      if (OriginalAudioContext && !OriginalAudioContext.__isPatched) {
        window.AudioContext = function(...args) {
          const ctx = new OriginalAudioContext(...args);
          if (!window.__globalMediaStreamDest) {
            window.__globalMediaStreamDest = ctx.createMediaStreamDestination();
          }
          ctx.__mediaStreamDest = window.__globalMediaStreamDest;
          return ctx;
        };
        window.AudioContext.__isPatched = true;
      }

      const originalConnect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (destination, ...args) {
        if (destination === this.context.destination) {
          if (!this.context.__mediaStreamDest) {
            this.context.__mediaStreamDest = window.__globalMediaStreamDest || this.context.createMediaStreamDestination();
            window.__globalMediaStreamDest = this.context.__mediaStreamDest;
          }
          originalConnect.call(this, this.context.__mediaStreamDest);
        }
        return originalConnect.call(this, destination, ...args);
      };
    }

    startTimeRef.current = Date.now();
    let blobUrl = null;

    const setupWebRTC = (newSocket) => {
      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit('webrtc_ice_candidate', { roomId, candidate: event.candidate });
        }
      };

      if (role === 'host') {
        // Capture canvas stream safely
        try {
          const captureFn = canvasRef.current.captureStream || canvasRef.current.mozCaptureStream;
          if (captureFn) {
            const stream = captureFn.call(canvasRef.current, 60); // 60 FPS for smoother remote play
            
            // Add captured audio track to the video stream
            if (window.__globalMediaStreamDest) {
              const audioTracks = window.__globalMediaStreamDest.stream.getAudioTracks();
              audioTracks.forEach(track => stream.addTrack(track));
            }
            
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
          } else {
            console.warn('captureStream is not supported by this browser.');
          }
        } catch (e) {
          console.error('Failed to capture canvas stream:', e);
        }

        // Create WebRTC Data Channel for ultra-low latency inputs
        const dataChannel = pc.createDataChannel('inputs');
        dataChannel.onmessage = (event) => {
          if (!nostalgistRef.current) return;
          try {
            const { button, state, playerNum } = JSON.parse(event.data);
            if (state === 'down') {
              nostalgistRef.current.pressDown({ button, player: playerNum });
            } else {
              nostalgistRef.current.pressUp({ button, player: playerNum });
            }
          } catch (err) {
            console.error('Data channel error:', err);
          }
        };

        const createAndSendOffer = async () => {
          if (pc.signalingState === 'closed') return;
          try {
            if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
              // Resend existing offer if already created
              newSocket.emit('webrtc_offer', { roomId, offer: pc.localDescription });
              return;
            }
            
            setWebrtcStatus('Creating Offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            newSocket.emit('webrtc_offer', { roomId, offer });
          } catch (e) {
            console.error('Error creating offer', e);
            if (pc.signalingState !== 'closed') {
              setWebrtcStatus('Error Creating Offer');
            }
          }
        };

        // Emit that host is ready, and create offer if Joiner says they are ready
        newSocket.emit('webrtc_host_ready', { roomId });
        newSocket.on('webrtc_client_ready', createAndSendOffer);
        newSocket.on('user_joined_lobby', createAndSendOffer);

        newSocket.on('webrtc_answer_receive', async ({ answer }) => {
          try {
            setWebrtcStatus('Connected to Player 2');
            const remoteDesc = new RTCSessionDescription(answer);
            if (pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(remoteDesc);
            }
          } catch (e) {
            console.error('Error setting remote answer', e);
          }
        });
        
      } else {
        // Client receives tracks
        pc.ontrack = (event) => {
          if (videoRef.current && event.streams && event.streams[0]) {
            if (videoRef.current.srcObject !== event.streams[0]) {
              videoRef.current.srcObject = event.streams[0];
              setWebrtcStatus('Stream Connected');
              videoRef.current.play().catch(e => console.error("Autoplay failed:", e));
            }
          }
        };

        // Listen for Data Channel
        pc.ondatachannel = (event) => {
          dataChannelRef.current = event.channel;
        };

        newSocket.on('webrtc_offer_receive', async ({ offer }) => {
          try {
            setWebrtcStatus('Receiving Video Stream...');
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            newSocket.emit('webrtc_answer', { roomId, answer });
          } catch (e) {
            console.error('Error handling offer', e);
            setWebrtcStatus('Error Handling Offer');
          }
        });
        
        // Notify host we are ready for the offer
        newSocket.emit('join_room_lobby', { roomId, userId: 'emulator_client', username: role });
        newSocket.emit('webrtc_client_ready', { roomId });
        
        // If host was already ready, this will trigger them
        newSocket.on('webrtc_host_ready', () => {
          newSocket.emit('webrtc_client_ready', { roomId });
        });
      }

      // Both Host and Client should handle connection drops
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
           setWebrtcStatus('Connection Lost');
           if (role === 'client') {
             alert('Connection to Host lost.');
             window.location.href = `/multiplayer/lobby?roomId=${roomId}`;
           }
        }
      };

      newSocket.on('webrtc_ice_candidate_receive', async ({ candidate }) => {
        try {
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      });
    };

    const launchEmulator = async () => {
      try {
        let newSocket = null;
        if (multiplayer && roomId && role) {
          setWebrtcStatus('Connecting to Server...');
          const isProd = process.env.NODE_ENV === 'production';
          newSocket = io(isProd ? undefined : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'));
          setSocket(newSocket);
          
          if (role === 'host') {
            newSocket.emit('join_room_lobby', { roomId, userId: 'emulator_host', username: role });
          }
        }

        // If Joiner, they don't have the ROM locally. We use the platform passed in the URL.
        const urlPlatform = searchParams.get('platform');
        
        let metadata = null;
        if (role !== 'client') {
          const res = await api.get('/roms');
          metadata = res.data.find((r) => r.romHash === hash);
          if (!metadata) {
            setError('ROM metadata not found. Please re-upload in Dashboard.');
            return;
          }
          setPlatform(metadata.platform);
        } else if (urlPlatform) {
          setPlatform(urlPlatform);
        }

        if (role === 'client') {
          // Client skips emulation and just sets up WebRTC
          if (newSocket) setupWebRTC(newSocket);
          return;
        }

        // Host and Singleplayer Emulator Launch
        const blob = await getRomLocally(hash);
        if (!blob) {
          setError('ROM not found locally. Please return to the dashboard and re-upload.');
          return;
        }

        let core = 'fceumm'; // NES
        if (metadata.platform === 'SNES') core = 'snes9x';
        if (metadata.platform === 'GBA') core = 'mgba';
        if (metadata.platform === 'Genesis') core = 'genesis_plus_gx';

        blobUrl = URL.createObjectURL(blob);

        const nInst = await Nostalgist.launch({
          core: core,
          rom: blobUrl,
          element: canvasRef.current,
          retroarchConfig: {
            // Map Player 2 to arbitrary UNIQUE keyboard keys so Nostalgist's pressDown(player: 2) can translate them
            // They must not overlap with Player 1's defaults (arrows, z, x, a, s, q, w, enter, shift)
            input_player2_up: "i",
            input_player2_down: "k",
            input_player2_left: "j",
            input_player2_right: "l",
            input_player2_a: "v",
            input_player2_b: "b",
            input_player2_x: "n",
            input_player2_y: "m",
            input_player2_l: "u",
            input_player2_r: "o",
            input_player2_start: "p",
            input_player2_select: "y",
          }
        });

        setNostalgistInst(nInst);
        nostalgistRef.current = nInst;

        if (multiplayer && newSocket && role === 'host') {
          setupWebRTC(newSocket);



          newSocket.on('netplay_pause_receive', () => {
            if (nostalgistRef.current) nostalgistRef.current.pause();
          });

          newSocket.on('netplay_resume_receive', () => {
            if (nostalgistRef.current) nostalgistRef.current.resume();
          });
        }

      } catch (err) {
        console.error(err);
        setError('Failed to launch emulator core.');
      }
    };

    launchEmulator();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      if (nostalgistRef.current) nostalgistRef.current.exit();
      setSocket(s => { if (s) s.disconnect(); return null; });
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      
      if (role !== 'client') {
        const playTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (playTimeSeconds > 5) {
          api.put(`/roms/${hash}/play`, { playTime: playTimeSeconds }).catch(console.error);
        }
      }
    };
  }, [hash, multiplayer, roomId, role]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const handleExit = async () => {
    try {
      if (role !== 'client') {
        const playTimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (playTimeSeconds > 1) {
          await api.put(`/roms/${hash}/play`, { playTime: playTimeSeconds });
        }
      }
    } catch (e) {
      console.error('Failed to save play stats:', e);
    }
    
    if (multiplayer && roomId) {
      window.location.href = `/multiplayer/lobby?roomId=${roomId}`;
    } else {
      window.location.href = '/dashboard';
    }
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
          
          {!multiplayer && (
            <button onClick={openSaveModal} className="p-3 md:p-4 bg-black/60 rounded-full text-[#00f3ff] hover:bg-black/90 transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)] backdrop-blur-md border border-[#00f3ff]/50 group relative" title="Save State">
              <Save className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
          
          <button onClick={handleExit} className="p-3 md:p-4 bg-black/60 rounded-full text-white hover:text-red-400 hover:bg-black/90 transition-all shadow-lg backdrop-blur-md border border-white/10 group relative" title="Exit">
            <LogOut className="w-5 h-5 md:w-6 md:h-6" />
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
        
        {multiplayer && webrtcStatus && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[80] bg-black/80 px-4 py-2 rounded-full border border-[#bc13fe]/50 text-[#bc13fe] text-xs font-bold font-mono tracking-widest shadow-[0_0_15px_rgba(188,19,254,0.3)] backdrop-blur-md animate-pulse">
            {webrtcStatus}
          </div>
        )}

        <div className="relative w-full max-w-[1000px] h-full max-h-[65vh] md:max-h-full mx-auto bg-black border border-white/10 rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)]">
          {role !== 'client' && (
            <canvas 
              ref={canvasRef} 
              className="w-full h-full object-contain bg-black pointer-events-none" 
              tabIndex="-1"
            />
          )}
          {role === 'client' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black pointer-events-none"
            />
          )}
        </div>

        <VirtualController 
          nostalgist={nostalgistInst} 
          platform={platform} 
          playerNum={multiplayer ? (role === 'host' ? 1 : 2) : 1}
          onInput={({ button, state }) => {
            if (multiplayer && role === 'client') {
              if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
                dataChannelRef.current.send(JSON.stringify({ button, state, playerNum: 2 }));
              }
            }
          }}
        />
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
