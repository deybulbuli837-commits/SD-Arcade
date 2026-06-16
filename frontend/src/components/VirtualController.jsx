'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Joystick } from 'react-joystick-component';
import { getControllerConfig } from '../utils/controllerConfig';

export default function VirtualController({ nostalgist, className = "absolute inset-0 z-50 pointer-events-none overflow-hidden", configOverride, platform }) {
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
    if (nostalgistRef.current) nostalgistRef.current.pressDown(targetButton);
    
    let isDown = true;
    turboIntervals.current[targetButton] = setInterval(() => {
      if (!nostalgistRef.current) return;
      isDown = !isDown;
      if (isDown) nostalgistRef.current.pressDown(targetButton);
      else nostalgistRef.current.pressUp(targetButton);
    }, 50);
  }, []);

  const stopTurbo = useCallback((targetButton) => {
    if (turboIntervals.current[targetButton]) {
      clearInterval(turboIntervals.current[targetButton]);
      delete turboIntervals.current[targetButton];
      if (nostalgistRef.current) nostalgistRef.current.pressUp(targetButton);
    }
  }, []);

  const triggerPress = useCallback((button) => {
    if (!nostalgistRef.current) return;
    if (platform === 'NES' || platform === 'GBA') {
      if (button === 'x') { startTurbo('a'); return; }
      if (button === 'y') { startTurbo('b'); return; }
    }
    nostalgistRef.current.pressDown(button);
  }, [platform, startTurbo]);

  const triggerRelease = useCallback((button) => {
    if (!nostalgistRef.current) return;
    if (platform === 'NES' || platform === 'GBA') {
      if (button === 'x') { stopTurbo('a'); return; }
      if (button === 'y') { stopTurbo('b'); return; }
    }
    nostalgistRef.current.pressUp(button);
  }, [platform, stopTurbo]);

  // Global Keyboard Listener
  useEffect(() => {
    if (!nostalgist) return;

    const keyMap = {};
    const mapKeys = (groupKeys, groupName) => {
      Object.entries(groupKeys).forEach(([buttonName, keyStr]) => {
        keyMap[keyStr.toLowerCase()] = buttonName;
      });
    };
    
    mapKeys(config.joystick.keys, 'joystick');
    mapKeys(config.actions.keys, 'actions');
    mapKeys(config.system.keys, 'system');
    mapKeys(config.shoulderL.keys, 'shoulderL');
    mapKeys(config.shoulderR.keys, 'shoulderR');

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      const button = keyMap[key];
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (!pressedKeys.current.has(key)) {
          pressedKeys.current.add(key);
          triggerPress(button);
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      const button = keyMap[key];
      if (button) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (pressedKeys.current.has(key)) {
          pressedKeys.current.delete(key);
          triggerRelease(button);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      
      // Cleanup turbo intervals on unmount
      Object.keys(turboIntervals.current).forEach(btn => {
        clearInterval(turboIntervals.current[btn]);
      });
    };
  }, [nostalgist, config, triggerPress, triggerRelease]);

  const handleJoystickMove = (e) => {
    if (!nostalgistRef.current) return;
    const threshold = 15; // Lower Deadzone threshold
    const newDirections = new Set();
    
    if (e.y > threshold) newDirections.add('up');
    if (e.y < -threshold) newDirections.add('down');
    if (e.x > threshold) newDirections.add('right');
    if (e.x < -threshold) newDirections.add('left');

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

  const ActionButton = ({ label, buttonKey, pcKey, color = 'bg-[#bc13fe]' }) => (
    <div className="relative">
      <button
        onPointerDown={(e) => { e.preventDefault(); triggerPress(buttonKey); }}
        onPointerUp={(e) => { e.preventDefault(); triggerRelease(buttonKey); }}
        onPointerLeave={(e) => { e.preventDefault(); triggerRelease(buttonKey); }}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-white font-bold text-xl shadow-[0_0_15px_rgba(188,19,254,0.5)] active:scale-95 transition-transform select-none touch-none`}
      >
        {label}
      </button>
      <span className="hidden lg:block absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-[#00f3ff] font-mono font-bold bg-black/80 px-2 py-0.5 rounded border border-[#00f3ff]/30 pointer-events-none uppercase">
        {pcKey}
      </span>
    </div>
  );

  return (
    <div className={className} style={{ opacity: config.opacity }}>
      <div className="w-full h-full pointer-events-none relative">
        
        {/* Shoulder L */}
        <div className="absolute pointer-events-auto" style={{ left: `${config.shoulderL.left}%`, top: `${config.shoulderL.top}%`, transform: `scale(${config.shoulderL.scale})` }}>
          <button
            onPointerDown={(e) => { e.preventDefault(); triggerPress('l'); }}
            onPointerUp={(e) => { e.preventDefault(); triggerRelease('l'); }}
            onPointerLeave={(e) => { e.preventDefault(); triggerRelease('l'); }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-24 h-10 rounded-full bg-gray-800/80 border border-white/20 text-white font-bold text-sm shadow-[0_0_10px_rgba(255,255,255,0.1)] active:scale-95 transition-transform select-none touch-none flex items-center justify-center gap-2"
          >
            L <span className="hidden lg:inline text-[10px] text-[#00f3ff] font-mono border border-[#00f3ff]/30 px-1 rounded bg-black/50 uppercase">{config.shoulderL.keys.l}</span>
          </button>
        </div>

        {/* Shoulder R */}
        <div className="absolute pointer-events-auto" style={{ left: `${config.shoulderR.left}%`, top: `${config.shoulderR.top}%`, transform: `scale(${config.shoulderR.scale})` }}>
          <button
            onPointerDown={(e) => { e.preventDefault(); triggerPress('r'); }}
            onPointerUp={(e) => { e.preventDefault(); triggerRelease('r'); }}
            onPointerLeave={(e) => { e.preventDefault(); triggerRelease('r'); }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-24 h-10 rounded-full bg-gray-800/80 border border-white/20 text-white font-bold text-sm shadow-[0_0_10px_rgba(255,255,255,0.1)] active:scale-95 transition-transform select-none touch-none flex items-center justify-center gap-2"
          >
            R <span className="hidden lg:inline text-[10px] text-[#00f3ff] font-mono border border-[#00f3ff]/30 px-1 rounded bg-black/50 uppercase">{config.shoulderR.keys.r}</span>
          </button>
        </div>

        {/* Joystick */}
        <div className="absolute pointer-events-auto touch-none" style={{ left: `${config.joystick.left}%`, top: `${config.joystick.top}%`, transform: `scale(${config.joystick.scale})` }}>
          <Joystick 
            size={120} 
            baseColor="rgba(255,255,255,0.1)" 
            stickColor="rgba(0,243,255,0.8)" 
            move={handleJoystickMove} 
            stop={handleJoystickStop} 
          />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden lg:flex gap-1 pointer-events-none">
            {['up','down','left','right'].map(k => (
              <span key={k} className="text-[10px] text-[#00f3ff] font-mono font-bold bg-black/80 px-1 rounded border border-[#00f3ff]/30 uppercase">
                {config.joystick.keys[k]}
              </span>
            ))}
          </div>
        </div>

        {/* System Buttons */}
        <div className="absolute flex gap-4 pointer-events-auto" style={{ left: `${config.system.left}%`, top: `${config.system.top}%`, transform: `scale(${config.system.scale})` }}>
          {/* Select */}
          <div className="flex flex-col items-center gap-2">
            <span className="hidden lg:block text-[10px] text-[#00f3ff] font-mono border border-[#00f3ff]/30 px-1 rounded bg-black/50 uppercase">{config.system.keys.select}</span>
            <button
              onPointerDown={(e) => { e.preventDefault(); triggerPress('select'); }}
              onPointerUp={(e) => { e.preventDefault(); triggerRelease('select'); }}
              onPointerLeave={(e) => { e.preventDefault(); triggerRelease('select'); }}
              onContextMenu={(e) => e.preventDefault()}
              className="w-12 h-6 rounded-full bg-gray-700/80 border border-white/20 text-white text-xs font-bold active:scale-95 transition-transform select-none touch-none"
            >
              SEL
            </button>
          </div>
          {/* Start */}
          <div className="flex flex-col items-center gap-2">
            <span className="hidden lg:block text-[10px] text-[#00f3ff] font-mono border border-[#00f3ff]/30 px-1 rounded bg-black/50 uppercase">{config.system.keys.start}</span>
            <button
              onPointerDown={(e) => { e.preventDefault(); triggerPress('start'); }}
              onPointerUp={(e) => { e.preventDefault(); triggerRelease('start'); }}
              onPointerLeave={(e) => { e.preventDefault(); triggerRelease('start'); }}
              onContextMenu={(e) => e.preventDefault()}
              className="w-12 h-6 rounded-full bg-gray-700/80 border border-white/20 text-white text-xs font-bold active:scale-95 transition-transform select-none touch-none"
            >
              STRT
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute w-40 h-40 pointer-events-auto" style={{ left: `${config.actions.left}%`, top: `${config.actions.top}%`, transform: `scale(${config.actions.scale})` }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2">
            <ActionButton label="X" buttonKey="x" pcKey={config.actions.keys.x} color="bg-[#00f3ff]" />
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <ActionButton label="B" buttonKey="b" pcKey={config.actions.keys.b} color="bg-[#bc13fe]" />
          </div>
          <div className="absolute top-1/2 left-0 -translate-y-1/2">
            <ActionButton label="Y" buttonKey="y" pcKey={config.actions.keys.y} color="bg-[#00f3ff]" />
          </div>
          <div className="absolute top-1/2 right-0 -translate-y-1/2">
            <ActionButton label="A" buttonKey="a" pcKey={config.actions.keys.a} color="bg-[#bc13fe]" />
          </div>
        </div>

      </div>
    </div>
  );
}
