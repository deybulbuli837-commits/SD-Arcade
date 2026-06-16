'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import ProtectedRoute from '../../components/ProtectedRoute';
import VirtualController from '../../components/VirtualController';
import { Settings as SettingsIcon, Save, Move } from 'lucide-react';
import { getControllerConfig, saveControllerConfig } from '../../utils/controllerConfig';

export default function SettingsPage() {
  const [config, setConfig] = useState(getControllerConfig());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('layout'); // 'layout' | 'keys' | 'opacity'
  const [draggingGroup, setDraggingGroup] = useState(null);
  
  const previewRef = useRef(null);

  useEffect(() => {
    setConfig(getControllerConfig());
  }, []);

  const handleSave = () => {
    saveControllerConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // --- Drag and Drop Logic ---
  const handlePointerDown = (group, e) => {
    if (activeTab !== 'layout') return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingGroup(group);
  };

  const handlePointerMove = (e) => {
    if (!draggingGroup || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    
    // Calculate percentage position
    let left = ((e.clientX - rect.left) / rect.width) * 100;
    let top = ((e.clientY - rect.top) / rect.height) * 100;

    // Constrain to 0-100%
    left = Math.max(0, Math.min(100, left));
    top = Math.max(0, Math.min(100, top));

    setConfig(prev => ({
      ...prev,
      [draggingGroup]: { ...prev[draggingGroup], left, top }
    }));
  };

  const handlePointerUp = () => {
    setDraggingGroup(null);
  };

  // --- Key Rebinding Logic ---
  const handleKeyRebind = (group, action, e) => {
    e.preventDefault();
    const newKey = e.key.toLowerCase();
    if (newKey === 'escape') return; // Cancel bind
    
    setConfig(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        keys: {
          ...prev[group].keys,
          [action]: newKey === ' ' ? 'space' : newKey
        }
      }
    }));
  };

  // Helper to render Draggable Blocks over the Preview
  const DraggableOverlay = ({ groupName, label }) => {
    const isDragging = draggingGroup === groupName;
    return (
      <div 
        className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center cursor-move transition-colors z-[60] ${isDragging ? 'bg-[#bc13fe]/80 border-2 border-white' : 'bg-[#00f3ff]/40 hover:bg-[#00f3ff]/80 border border-[#00f3ff]'}`}
        style={{ left: `${config[groupName].left}%`, top: `${config[groupName].top}%` }}
        onPointerDown={(e) => handlePointerDown(groupName, e)}
      >
        <Move className="text-white w-5 h-5" />
      </div>
    );
  };

  const KeyBindInput = ({ group, action, label }) => (
    <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
      <span className="font-bold text-gray-300 w-24">{label}</span>
      <input 
        type="text" 
        value={config[group].keys[action].toUpperCase()} 
        readOnly
        onKeyDown={(e) => handleKeyRebind(group, action, e)}
        className="bg-black border border-[#00f3ff]/50 rounded text-center text-[#00f3ff] font-mono font-bold py-1 w-24 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#bc13fe]"
        placeholder="Press key..."
        title="Click and press any key to rebind"
      />
    </div>
  );

  return (
    <ProtectedRoute>
      <Navbar />
      <div 
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-[#00f3ff]" />
          <h1 className="text-3xl font-black neon-text tracking-tight">Controller Setup</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Settings Tabs & Panel */}
          <div className="glass-card p-6 h-fit flex flex-col gap-6">
            
            <div className="flex bg-black/50 p-1 rounded-lg">
              {['layout', 'keys', 'opacity'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-sm font-bold capitalize rounded-md transition-all ${activeTab === tab ? 'bg-[#bc13fe] text-white shadow-[0_0_10px_rgba(188,19,254,0.5)]' : 'text-gray-400 hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'layout' && (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Drag the control clusters directly on the preview window to reposition them.</p>
                {['joystick', 'actionA', 'actionB', 'actionX', 'actionY', 'system', 'shoulderL', 'shoulderR'].map(group => (
                  <div key={group} className="space-y-2">
                    <label className="flex justify-between text-xs font-bold text-[#00f3ff] uppercase tracking-wider">
                      {group.replace('action', 'Button ')} Size <span className="text-white">{Math.round(config[group].scale * 100)}%</span>
                    </label>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" 
                      value={config[group].scale} 
                      onChange={(e) => setConfig(prev => ({ ...prev, [group]: { ...prev[group], scale: parseFloat(e.target.value) } }))}
                      className="w-full accent-[#00f3ff]"
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'keys' && (
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-gray-400 text-sm">Click an input box and press a key to rebind it.</p>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#bc13fe] uppercase border-b border-[#bc13fe]/30 pb-1">D-Pad / Joystick</h3>
                  <KeyBindInput group="joystick" action="up" label="Up" />
                  <KeyBindInput group="joystick" action="down" label="Down" />
                  <KeyBindInput group="joystick" action="left" label="Left" />
                  <KeyBindInput group="joystick" action="right" label="Right" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#bc13fe] uppercase border-b border-[#bc13fe]/30 pb-1">Action Buttons</h3>
                  <KeyBindInput group="actionA" action="a" label="A Button" />
                  <KeyBindInput group="actionB" action="b" label="B Button" />
                  <KeyBindInput group="actionX" action="x" label="X Button" />
                  <KeyBindInput group="actionY" action="y" label="Y Button" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#bc13fe] uppercase border-b border-[#bc13fe]/30 pb-1">Shoulders & System</h3>
                  <KeyBindInput group="shoulderL" action="l" label="L Bumper" />
                  <KeyBindInput group="shoulderR" action="r" label="R Bumper" />
                  <KeyBindInput group="system" action="start" label="Start" />
                  <KeyBindInput group="system" action="select" label="Select" />
                </div>
              </div>
            )}

            {activeTab === 'opacity' && (
              <div className="space-y-4">
                <label className="flex justify-between items-center text-gray-300">
                  <span className="font-medium">Global Opacity</span>
                  <span className="text-[#00f3ff] font-mono">{Math.round(config.opacity * 100)}%</span>
                </label>
                <input 
                  type="range" min="0.1" max="1" step="0.05" 
                  value={config.opacity} 
                  onChange={(e) => setConfig(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                  className="w-full accent-[#bc13fe]"
                />
              </div>
            )}

            <button 
              onClick={handleSave}
              className="mt-4 w-full py-3 bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50 rounded-lg font-bold hover:bg-[#00f3ff]/40 transition-colors flex justify-center items-center gap-2"
            >
              {saved ? 'Saved Successfully!' : <><Save className="w-5 h-5" /> Save Configuration</>}
            </button>
          </div>

          {/* Live Preview Area */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold flex justify-between items-center">
              Live Layout
              {activeTab === 'layout' && <span className="text-xs bg-[#bc13fe] px-2 py-1 rounded animate-pulse">Drag Mode Active</span>}
            </h2>
            <div 
              ref={previewRef}
              className="relative w-full aspect-[4/3] max-h-[600px] bg-black border border-white/20 rounded-xl overflow-hidden shadow-2xl touch-none"
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')] opacity-50"></div>
              
              {/* Fake Gameplay Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 opacity-30 flex items-center justify-center pointer-events-none">
                <p className="text-white/20 font-black text-4xl tracking-widest rotate-12">SCREEN AREA</p>
              </div>
              
              {/* The Controller Itself */}
              <VirtualController nostalgist={null} className="absolute inset-0 z-40 pointer-events-none overflow-hidden" configOverride={config} />

              {/* Drag Handles Overlay */}
              {activeTab === 'layout' && (
                <>
                  <DraggableOverlay groupName="shoulderL" />
                  <DraggableOverlay groupName="shoulderR" />
                  <DraggableOverlay groupName="joystick" />
                  <DraggableOverlay groupName="actionA" />
                  <DraggableOverlay groupName="actionB" />
                  <DraggableOverlay groupName="actionX" />
                  <DraggableOverlay groupName="actionY" />
                  <DraggableOverlay groupName="system" />
                </>
              )}
            </div>
            <p className="text-sm text-gray-400 text-center">Your custom layout applies instantly to both mobile and desktop play.</p>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
