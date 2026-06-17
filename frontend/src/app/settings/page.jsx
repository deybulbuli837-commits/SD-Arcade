'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import ProtectedRoute from '../../components/ProtectedRoute';
import VirtualController from '../../components/VirtualController';
import { Settings as SettingsIcon, Save, Move, ArrowLeft } from 'lucide-react';
import { getControllerConfig, saveControllerConfig } from '../../utils/controllerConfig';

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState(getControllerConfig());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('layout'); // 'layout' | 'keys' | 'opacity'
  const [draggingGroup, setDraggingGroup] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
  const renderDraggableOverlay = (groupName) => {
    const isDragging = draggingGroup === groupName;
    return (
      <div 
        key={groupName}
        className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center cursor-move transition-colors z-[60] ${isDragging ? 'bg-[#bc13fe]/80 border-2 border-white' : 'bg-[#00f3ff]/40 hover:bg-[#00f3ff]/80 border border-[#00f3ff]'}`}
        style={{ left: `${config[groupName].left}%`, top: `${config[groupName].top}%` }}
        onPointerDown={(e) => handlePointerDown(groupName, e)}
      >
        <Move className="text-white w-5 h-5" />
      </div>
    );
  };

  const renderKeyBindInput = (group, action, label) => (
    <div key={`${group}-${action}`} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
      <span className="font-bold text-gray-300 w-24">{label}</span>
      <input 
        type="text" 
        value={config[group].keys[action].toUpperCase()} 
        readOnly
        onKeyDown={(e) => handleKeyRebind(group, action, e)}
        className="bg-black/50 border border-white/20 text-white font-mono font-bold text-center w-24 py-1 rounded focus:outline-none focus:border-[#bc13fe] focus:shadow-[0_0_10px_rgba(188,19,254,0.5)] cursor-pointer"
        placeholder="Press Key"
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
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/dashboard')} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors" title="Back to Dashboard">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-[#00f3ff]" />
            <h1 className="text-3xl font-black neon-text tracking-tight">Controller Setup</h1>
          </div>
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
                <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/5 p-3 rounded border border-white/10 gap-3">
                  <span className="text-sm font-bold text-white">D-Pad Style</span>
                  <div className="flex bg-black/50 rounded p-1 gap-1">
                    <button 
                      onClick={() => setConfig(prev => ({ ...prev, dpadType: 'typeA' }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${config.dpadType === 'typeA' ? 'bg-[#00f3ff] text-black shadow-[0_0_10px_rgba(0,243,255,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      Type A (Analog)
                    </button>
                    <button 
                      onClick={() => setConfig(prev => ({ ...prev, dpadType: 'typeB' }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${config.dpadType === 'typeB' ? 'bg-[#bc13fe] text-white shadow-[0_0_10px_rgba(188,19,254,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      Type B (Cross)
                    </button>
                    <button 
                      onClick={() => setConfig(prev => ({ ...prev, dpadType: 'typeC' }))}
                      className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${config.dpadType === 'typeC' ? 'bg-[#00f3ff] text-black shadow-[0_0_10px_rgba(0,243,255,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                      Type C (Floating)
                    </button>
                  </div>
                </div>

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
                
                <div className="space-y-4">
                  <h3 className="text-[#00f3ff] font-bold uppercase tracking-widest text-xs">Movement</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderKeyBindInput('joystick', 'up', 'Up')}
                    {renderKeyBindInput('joystick', 'down', 'Down')}
                    {renderKeyBindInput('joystick', 'left', 'Left')}
                    {renderKeyBindInput('joystick', 'right', 'Right')}
                  </div>
                  
                  <h3 className="text-[#00f3ff] font-bold uppercase tracking-widest text-xs pt-4 border-t border-white/10">Action Buttons</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderKeyBindInput('actionB', 'b', 'B (Nintendo A)')}
                    {renderKeyBindInput('actionA', 'a', 'A (Nintendo B)')}
                    {renderKeyBindInput('actionY', 'y', 'Y (Nintendo X)')}
                    {renderKeyBindInput('actionX', 'x', 'X (Nintendo Y)')}
                  </div>

                  <h3 className="text-[#00f3ff] font-bold uppercase tracking-widest text-xs pt-4 border-t border-white/10">Shoulders & System</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderKeyBindInput('shoulderL', 'l', 'L Bumper')}
                    {renderKeyBindInput('shoulderR', 'r', 'R Bumper')}
                    {renderKeyBindInput('system', 'select', 'Select')}
                    {renderKeyBindInput('system', 'start', 'Start')}
                  </div>
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
              {activeTab === 'layout' && (
                <button 
                  onClick={() => setIsFullscreen(true)}
                  className="text-xs bg-[#00f3ff] text-black font-bold px-3 py-1.5 rounded hover:bg-white transition-colors"
                >
                  Edit in Fullscreen
                </button>
              )}
            </h2>
            <div className="flex justify-center bg-gray-900/50 rounded-xl p-4 border border-white/5">
              <div 
                ref={!isFullscreen ? previewRef : null}
                className="relative w-full h-[60vh] min-h-[400px] bg-black border border-white/20 rounded-xl overflow-hidden shadow-2xl touch-none"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')] opacity-50"></div>
                
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 opacity-30 flex items-center justify-center pointer-events-none">
                  <p className="text-white/20 font-black text-4xl tracking-widest rotate-12 text-center px-4">
                    SCREEN AREA
                  </p>
                </div>
              
                <VirtualController nostalgist={null} className="absolute inset-0 z-40 pointer-events-none overflow-hidden" configOverride={config} />

                {activeTab === 'layout' && !isFullscreen && (
                  <>
                    {renderDraggableOverlay('shoulderL')}
                    {renderDraggableOverlay('shoulderR')}
                    {renderDraggableOverlay('joystick')}
                    {renderDraggableOverlay('actionA')}
                    {renderDraggableOverlay('actionB')}
                    {renderDraggableOverlay('actionX')}
                    {renderDraggableOverlay('actionY')}
                    {renderDraggableOverlay('system')}
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center">To accurately arrange buttons for mobile, use the <strong>Edit in Fullscreen</strong> mode on your device.</p>
          </div>

        </div>
      </div>

      {/* Fullscreen Editor Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-[100] bg-black touch-none"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')] opacity-50"></div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <p className="text-[#00f3ff] font-black text-5xl tracking-widest rotate-12 text-center">
              FULLSCREEN EDITOR
            </p>
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[110] flex gap-4">
            <button 
              onClick={() => setIsFullscreen(false)}
              className="bg-gray-800 border border-white/20 text-white px-6 py-2 rounded-full font-bold shadow-lg pointer-events-auto"
            >
              Done Editing
            </button>
            <button 
              onClick={handleSave}
              className="bg-[#00f3ff] text-black px-6 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(0,243,255,0.4)] pointer-events-auto flex items-center gap-2"
            >
              {saved ? 'Saved!' : <><Save className="w-4 h-4" /> Save</>}
            </button>
          </div>

          <div ref={previewRef} className="absolute inset-0">
            <VirtualController nostalgist={null} className="absolute inset-0 z-40 pointer-events-none overflow-hidden" configOverride={config} />
            {activeTab === 'layout' && (
              <div className="absolute inset-0 z-50 pointer-events-auto">
                {renderDraggableOverlay('shoulderL')}
                {renderDraggableOverlay('shoulderR')}
                {renderDraggableOverlay('joystick')}
                {renderDraggableOverlay('actionA')}
                {renderDraggableOverlay('actionB')}
                {renderDraggableOverlay('actionX')}
                {renderDraggableOverlay('actionY')}
                {renderDraggableOverlay('system')}
              </div>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
