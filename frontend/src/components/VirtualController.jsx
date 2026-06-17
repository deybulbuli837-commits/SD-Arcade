'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Joystick } from 'react-joystick-component';
import { getControllerConfig } from '../utils/controllerConfig';

export default function VirtualController({ nostalgist, className = "absolute inset-0 z-50 pointer-events-none overflow-hidden", configOverride, platform, playerNum = 1, onInput }) {
  const [internalConfig, setInternalConfig] = useState(getControllerConfig());
  const config = configOverride || internalConfig;
  const activeDirections = useRef(new Set());
  const pressedKeys = useRef(new Set()); // Track physical keyboard keys
  const turboIntervals = useRef({});
  const nostalgistRef = useRef(nostalgist);

  useEffect(() => {
    nostalgistRef.current = nostalgist;
  }, [nostalgist]);

  useEffect(() => {
    const handleStorageChange = () => {
      setInternalConfig(getControllerConfig());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('arcade_settings_updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('arcade_settings_updated', handleStorageChange);
    };
  }, []);

  // --- Turbo Engine ---
  const startTurbo = useCallback((targetButton) => {
    if (turboIntervals.current[targetButton]) return;
    if (nostalgistRef.current) nostalgistRef.current.pressDown({ button: targetButton, player: playerNum });
    if (onInput) onInput({ button: targetButton, state: 'down' });
    
    let isDown = true;
    turboIntervals.current[targetButton] = setInterval(() => {
      isDown = !isDown;
      if (isDown) {
        if (nostalgistRef.current) nostalgistRef.current.pressDown({ button: targetButton, player: playerNum });
        if (onInput) onInput({ button: targetButton, state: 'down' });
      } else {
        if (nostalgistRef.current) nostalgistRef.current.pressUp({ button: targetButton, player: playerNum });
        if (onInput) onInput({ button: targetButton, state: 'up' });
      }
    }, 50);
  }, [playerNum, onInput]);

  const stopTurbo = useCallback((targetButton) => {
    if (turboIntervals.current[targetButton]) {
      clearInterval(turboIntervals.current[targetButton]);
      delete turboIntervals.current[targetButton];
      if (nostalgistRef.current) nostalgistRef.current.pressUp({ button: targetButton, player: playerNum });
      if (onInput) onInput({ button: targetButton, state: 'up' });
    }
  }, [playerNum, onInput]);

  const triggerPress = useCallback((button) => {
    if (platform === 'NES' || platform === 'GBA') {
      if (button === 'x') { startTurbo('a'); return; }
      if (button === 'y') { startTurbo('b'); return; }
    }
    if (nostalgistRef.current) nostalgistRef.current.pressDown({ button, player: playerNum });
    if (onInput) onInput({ button, state: 'down' });
  }, [platform, startTurbo, playerNum, onInput]);

  const triggerRelease = useCallback((button) => {
    if (platform === 'NES' || platform === 'GBA') {
      if (button === 'x') { stopTurbo('a'); return; }
      if (button === 'y') { stopTurbo('b'); return; }
    }
    if (nostalgistRef.current) nostalgistRef.current.pressUp({ button, player: playerNum });
    if (onInput) onInput({ button, state: 'up' });
  }, [platform, stopTurbo, playerNum, onInput]);

  // Global Keyboard Listener
  useEffect(() => {
    // If we have no nostalgist and no onInput handler, don't bother attaching listeners
    if (!nostalgist && !onInput) return;

    const keyMap = {};
    const mapKeys = (groupKeys, groupName) => {
      if (!groupKeys) return;
      Object.entries(groupKeys).forEach(([buttonName, keyStr]) => {
        keyMap[keyStr.toLowerCase()] = buttonName;
      });
    };
    
    mapKeys(config.joystick?.keys, 'joystick');
    mapKeys(config.system?.keys, 'system');
    mapKeys(config.shoulderL?.keys, 'shoulderL');
    mapKeys(config.shoulderR?.keys, 'shoulderR');
    
    // Support both old unified 'actions' and new independent ones
    mapKeys(config.actions?.keys, 'actions');
    mapKeys(config.actionA?.keys, 'actionA');
    mapKeys(config.actionB?.keys, 'actionB');
    mapKeys(config.actionX?.keys, 'actionX');
    mapKeys(config.actionY?.keys, 'actionY');

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const mappedButton = keyMap[key];
      if (mappedButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (!pressedKeys.current.has(key)) {
          pressedKeys.current.add(key);
          triggerPress(mappedButton);
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      const mappedButton = keyMap[key];
      if (mappedButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (pressedKeys.current.has(key)) {
          pressedKeys.current.delete(key);
          triggerRelease(mappedButton);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      
      Object.keys(turboIntervals.current).forEach(btn => {
        clearInterval(turboIntervals.current[btn]);
      });
    };
  }, [nostalgist, config, triggerPress, triggerRelease, onInput]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const handleJoystickMove = (e) => {
    if (!nostalgistRef.current) return;
    const newDirections = new Set();
    
    // react-joystick-component 'x' and 'y' could be pixels (e.g. 0 to 60) or normalized (0 to 1).
    const x = e.x || 0;
    const y = e.y || 0;
    
    // Detect if the values are normalized or pixel-based
    const isNormalized = Math.abs(x) <= 1.5 && Math.abs(y) <= 1.5;
    const threshold = isNormalized ? 0.2 : 5;
    
    if (y > threshold) newDirections.add('up');
    if (y < -threshold) newDirections.add('down');
    if (x > threshold) newDirections.add('right');
    if (x < -threshold) newDirections.add('left');

    // Fallback: Use direct string matching if coordinate math fails
    if (newDirections.size === 0 && e.direction) {
      if (e.direction === 'FORWARD') newDirections.add('up');
      if (e.direction === 'BACKWARD') newDirections.add('down');
      if (e.direction === 'RIGHT') newDirections.add('right');
      if (e.direction === 'LEFT') newDirections.add('left');
    }

    newDirections.forEach(dir => {
      if (!activeDirections.current.has(dir)) triggerPress(dir);
    });
    activeDirections.current.forEach(dir => {
      if (!newDirections.has(dir)) triggerRelease(dir);
    });
    activeDirections.current = newDirections;
  };

  const handleJoystickStop = () => {
    if (!nostalgistRef.current) return;
    activeDirections.current.forEach(dir => triggerRelease(dir));
    activeDirections.current.clear();
  };

  // --- Global Touch Listener for Macro Stacking (Bypasses Umbrella Rule) ---
  const activeTouchButtons = useRef(new Set());

  useEffect(() => {
    if (!isTouchDevice) return; // Only apply global touch logic on mobile
    
    const handleTouch = (e) => {
      const newActive = new Set();
      
      // Map all current touches to underlying elements
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
        
        elements.forEach(el => {
          const btnName = el.getAttribute('data-action-btn');
          if (btnName) {
            btnName.split(',').forEach(b => newActive.add(b));
          }
        });
      }

      // Fire presses for new buttons
      newActive.forEach(btn => {
        if (!activeTouchButtons.current.has(btn)) {
          triggerPress(btn);
        }
      });
      
      // Fire releases for buttons no longer touched
      activeTouchButtons.current.forEach(btn => {
        if (!newActive.has(btn)) {
          triggerRelease(btn);
        }
      });
      
      activeTouchButtons.current = newActive;
    };

    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleTouch, { passive: false });
    window.addEventListener('touchcancel', handleTouch, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleTouch);
      window.removeEventListener('touchcancel', handleTouch);
      
      // Failsafe release
      activeTouchButtons.current.forEach(btn => triggerRelease(btn));
      activeTouchButtons.current.clear();
    };
  }, [triggerPress, triggerRelease, isTouchDevice]);

  const ActionButton = ({ label, buttonKey, pcKey, color = 'bg-[#bc13fe]' }) => (
    <div className="relative pointer-events-auto touch-none">
      <button
        data-action-btn={buttonKey}
        onPointerDown={(e) => { if (e.pointerType === 'mouse') triggerPress(buttonKey); }}
        onPointerUp={(e) => { if (e.pointerType === 'mouse') triggerRelease(buttonKey); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') triggerRelease(buttonKey); }}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(188,19,254,0.3)] transition-transform select-none touch-none opacity-90`}
      >
        {label}
      </button>
      {!isTouchDevice && (
        <span className="hidden lg:block absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white/50 font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded border border-white/10 pointer-events-none uppercase">
          {pcKey}
        </span>
      )}
    </div>
  );

  return (
    <div className={className} style={{ opacity: config.opacity }}>
      <div className="w-full h-full pointer-events-none relative">
        
        {/* Shoulder L */}
        <div className="absolute pointer-events-auto touch-none" style={{ left: `${config.shoulderL.left}%`, top: `${config.shoulderL.top}%`, transform: `scale(${config.shoulderL.scale})` }}>
          <button
            data-action-btn="l"
            onPointerDown={(e) => { if (e.pointerType === 'mouse') triggerPress('l'); }}
            onPointerUp={(e) => { if (e.pointerType === 'mouse') triggerRelease('l'); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') triggerRelease('l'); }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-24 h-10 rounded-full bg-gray-800/60 border border-white/10 text-white font-bold text-sm shadow-[0_0_10px_rgba(255,255,255,0.05)] transition-transform select-none touch-none flex items-center justify-center gap-2 pointer-events-auto"
          >
            L 
            {!isTouchDevice && <span className="hidden lg:inline text-[9px] text-white/50 font-mono border border-white/10 px-1 rounded bg-black/40 uppercase">{config.shoulderL.keys.l}</span>}
          </button>
        </div>

        {/* Shoulder R */}
        <div className="absolute pointer-events-auto touch-none" style={{ left: `${config.shoulderR.left}%`, top: `${config.shoulderR.top}%`, transform: `scale(${config.shoulderR.scale})` }}>
          <button
            data-action-btn="r"
            onPointerDown={(e) => { if (e.pointerType === 'mouse') triggerPress('r'); }}
            onPointerUp={(e) => { if (e.pointerType === 'mouse') triggerRelease('r'); }}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') triggerRelease('r'); }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-24 h-10 rounded-full bg-gray-800/60 border border-white/10 text-white font-bold text-sm shadow-[0_0_10px_rgba(255,255,255,0.05)] transition-transform select-none touch-none flex items-center justify-center gap-2 pointer-events-auto"
          >
            R 
            {!isTouchDevice && <span className="hidden lg:inline text-[9px] text-white/50 font-mono border border-white/10 px-1 rounded bg-black/40 uppercase">{config.shoulderR.keys.r}</span>}
          </button>
        </div>

        {/* Joystick or Classic D-Pad */}
        <div className="absolute touch-none opacity-90 pointer-events-none" style={{ left: `${config.joystick.left}%`, top: `${config.joystick.top}%`, transform: `scale(${config.joystick.scale})`, width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px' }}>
          {config.dpadType === 'typeB' ? (
            <div className="relative w-full h-full">
              {/* Background Plate */}
              <div className="absolute inset-[10px] bg-black/40 rounded-full border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"></div>

              {/* The Cross Base */}
              <div className="absolute top-[20px] left-[40px] w-[40px] h-[80px] bg-gray-800 rounded shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-gray-600/50"></div>
              <div className="absolute top-[40px] left-[20px] w-[80px] h-[40px] bg-gray-800 rounded shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-gray-600/50"></div>
              
              {/* Center Merge (hides internal borders) */}
              <div className="absolute top-[41px] left-[41px] w-[38px] h-[38px] bg-gray-800 z-0"></div>
              
              {/* Center Pivot Divot */}
              <div className="absolute top-[50px] left-[50px] w-[20px] h-[20px] rounded-full bg-gray-900/60 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] z-0"></div>

              {/* Directional Arrows (Subtle) */}
              <div className="absolute top-[25px] left-[54px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-600/50 z-0"></div>
              <div className="absolute bottom-[25px] left-[54px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-600/50 z-0"></div>
              <div className="absolute left-[25px] top-[54px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-gray-600/50 z-0"></div>
              <div className="absolute right-[25px] top-[54px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-gray-600/50 z-0"></div>

              {/* Touch Zones (3x3 grid) - Now with mouse support! */}
              <div className="absolute inset-[-10px] grid grid-cols-3 grid-rows-3 z-10 pointer-events-auto">
                {['up,left', 'up', 'up,right', 'left', '', 'right', 'down,left', 'down', 'down,right'].map((dirs, idx) => (
                  <div 
                    key={idx}
                    data-action-btn={dirs || undefined} 
                    className="touch-none opacity-0"
                    onPointerDown={(e) => { 
                      if (e.pointerType === 'mouse' && dirs) dirs.split(',').forEach(d => triggerPress(d)); 
                    }}
                    onPointerUp={(e) => { 
                      if (e.pointerType === 'mouse' && dirs) dirs.split(',').forEach(d => triggerRelease(d)); 
                    }}
                    onPointerLeave={(e) => { 
                      if (e.pointerType === 'mouse' && dirs) dirs.split(',').forEach(d => triggerRelease(d)); 
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  ></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto">
              <Joystick 
                size={120} 
                baseColor="rgba(255,255,255,0.1)" 
                stickColor="rgba(0,243,255,0.5)" 
                move={handleJoystickMove} 
                stop={handleJoystickStop} 
              />
            </div>
          )}
          {!isTouchDevice && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden lg:flex gap-1 pointer-events-none">
              {['up','down','left','right'].map(k => (
                <span key={k} className="text-[9px] text-white/50 font-mono font-bold bg-black/60 px-1 rounded border border-white/10 uppercase">
                  {config.joystick.keys[k]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* System Buttons */}
        <div className="absolute flex gap-4 pointer-events-auto opacity-80" style={{ left: `${config.system.left}%`, top: `${config.system.top}%`, transform: `scale(${config.system.scale})` }}>
          {/* Select */}
          <div className="flex flex-col items-center gap-2">
            {!isTouchDevice && <span className="hidden lg:block text-[9px] text-white/50 font-mono border border-white/10 px-1 rounded bg-black/40 uppercase">{config.system.keys.select}</span>}
            <button
              onPointerDown={(e) => { e.preventDefault(); triggerPress('select'); }}
              onPointerUp={(e) => { e.preventDefault(); triggerRelease('select'); }}
              onPointerLeave={(e) => { e.preventDefault(); triggerRelease('select'); }}
              onContextMenu={(e) => e.preventDefault()}
              className="w-10 h-4 rounded-full bg-gray-600/60 border border-white/10 text-white/80 text-[10px] font-bold active:scale-95 transition-transform select-none touch-none"
            >
              SEL
            </button>
          </div>
          {/* Start */}
          <div className="flex flex-col items-center gap-2">
            {!isTouchDevice && <span className="hidden lg:block text-[9px] text-white/50 font-mono border border-white/10 px-1 rounded bg-black/40 uppercase">{config.system.keys.start}</span>}
            <button
              onPointerDown={(e) => { e.preventDefault(); triggerPress('start'); }}
              onPointerUp={(e) => { e.preventDefault(); triggerRelease('start'); }}
              onPointerLeave={(e) => { e.preventDefault(); triggerRelease('start'); }}
              onContextMenu={(e) => e.preventDefault()}
              className="w-10 h-4 rounded-full bg-gray-600/60 border border-white/10 text-white/80 text-[10px] font-bold active:scale-95 transition-transform select-none touch-none"
            >
              STR
            </button>
          </div>
        </div>

        {/* Independent Action Buttons */}
        <div className="absolute pointer-events-auto" style={{ left: `${config.actionX.left}%`, top: `${config.actionX.top}%`, transform: `scale(${config.actionX.scale})`, marginLeft: '-28px', marginTop: '-28px' }}>
          <ActionButton label="X" buttonKey="x" pcKey={config.actionX.keys.x} color="bg-[#00f3ff]/80" />
        </div>
        <div className="absolute pointer-events-auto" style={{ left: `${config.actionY.left}%`, top: `${config.actionY.top}%`, transform: `scale(${config.actionY.scale})`, marginLeft: '-28px', marginTop: '-28px' }}>
          <ActionButton label="Y" buttonKey="y" pcKey={config.actionY.keys.y} color="bg-[#00f3ff]/80" />
        </div>
        <div className="absolute pointer-events-auto" style={{ left: `${config.actionA.left}%`, top: `${config.actionA.top}%`, transform: `scale(${config.actionA.scale})`, marginLeft: '-28px', marginTop: '-28px' }}>
          <ActionButton label="A" buttonKey="a" pcKey={config.actionA.keys.a} color="bg-[#bc13fe]/80" />
        </div>
        <div className="absolute pointer-events-auto" style={{ left: `${config.actionB.left}%`, top: `${config.actionB.top}%`, transform: `scale(${config.actionB.scale})`, marginLeft: '-28px', marginTop: '-28px' }}>
          <ActionButton label="B" buttonKey="b" pcKey={config.actionB.keys.b} color="bg-[#bc13fe]/80" />
        </div>

      </div>
    </div>
  );
}
