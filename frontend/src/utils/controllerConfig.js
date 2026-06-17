export const DEFAULT_CONTROLLER_CONFIG = {
  opacity: 0.8,
  dpadType: 'typeA', // 'typeA' = Analog Joystick, 'typeB' = Classic Cross, 'typeC' = Floating Touch
  joystick: { 
    left: 10, top: 60, scale: 1, 
    keys: { up: 'w', down: 's', left: 'a', right: 'd' } 
  },
  actionA: { left: 85, top: 70, scale: 1, keys: { a: 'arrowup' } },
  actionB: { left: 75, top: 85, scale: 1, keys: { b: 'arrowleft' } },
  actionX: { left: 75, top: 55, scale: 1, keys: { x: 'arrowdown' } },
  actionY: { left: 65, top: 70, scale: 1, keys: { y: 'arrowright' } },
  system: { 
    left: 45, top: 85, scale: 1, 
    keys: { start: 'enter', select: 'shift' } 
  },
  shoulderL: { 
    left: 5, top: 5, scale: 1, 
    keys: { l: 'q' } 
  },
  shoulderR: { 
    left: 80, top: 5, scale: 1, 
    keys: { r: 'e' } 
  }
};

export const getControllerConfig = () => {
  if (typeof window === 'undefined') return DEFAULT_CONTROLLER_CONFIG;
  const saved = localStorage.getItem('arcade_ctrl_config');
  if (!saved) return DEFAULT_CONTROLLER_CONFIG;
  try {
    const parsed = JSON.parse(saved);
    
    // Migration logic for old unified 'actions' block
    let mergedActionA = { ...DEFAULT_CONTROLLER_CONFIG.actionA, ...parsed.actionA };
    let mergedActionB = { ...DEFAULT_CONTROLLER_CONFIG.actionB, ...parsed.actionB };
    let mergedActionX = { ...DEFAULT_CONTROLLER_CONFIG.actionX, ...parsed.actionX };
    let mergedActionY = { ...DEFAULT_CONTROLLER_CONFIG.actionY, ...parsed.actionY };

    // Only migrate if old 'actions' exist AND the user hasn't already saved new individual actions
    if (parsed.actions && !parsed.actionA) {
      if (parsed.actions.keys) {
        mergedActionA.keys = { a: parsed.actions.keys.a || mergedActionA.keys.a };
        mergedActionB.keys = { b: parsed.actions.keys.b || mergedActionB.keys.b };
        mergedActionX.keys = { x: parsed.actions.keys.x || mergedActionX.keys.x };
        mergedActionY.keys = { y: parsed.actions.keys.y || mergedActionY.keys.y };
      }
      
      mergedActionA.left = parsed.actions.left + 15;
      mergedActionA.top = parsed.actions.top + 10;
      mergedActionA.scale = parsed.actions.scale;
      
      mergedActionB.left = parsed.actions.left + 5;
      mergedActionB.top = parsed.actions.top + 25;
      mergedActionB.scale = parsed.actions.scale;
      
      mergedActionX.left = parsed.actions.left + 5;
      mergedActionX.top = parsed.actions.top - 5;
      mergedActionX.scale = parsed.actions.scale;
      
      mergedActionY.left = parsed.actions.left - 5;
      mergedActionY.top = parsed.actions.top + 10;
      mergedActionY.scale = parsed.actions.scale;
    }

    // Strip 'actions' from parsed so it gets cleanly removed on next save
    const { actions, ...cleanParsed } = parsed;

    return {
      ...DEFAULT_CONTROLLER_CONFIG,
      ...cleanParsed,
      actionA: mergedActionA,
      actionB: mergedActionB,
      actionX: mergedActionX,
      actionY: mergedActionY,
      dpadType: cleanParsed.dpadType || DEFAULT_CONTROLLER_CONFIG.dpadType,
      joystick: { ...DEFAULT_CONTROLLER_CONFIG.joystick, ...cleanParsed.joystick, keys: { ...DEFAULT_CONTROLLER_CONFIG.joystick.keys, ...(cleanParsed.joystick?.keys || {}) } },
      system: { ...DEFAULT_CONTROLLER_CONFIG.system, ...cleanParsed.system, keys: { ...DEFAULT_CONTROLLER_CONFIG.system.keys, ...(cleanParsed.system?.keys || {}) } },
      shoulderL: { ...DEFAULT_CONTROLLER_CONFIG.shoulderL, ...cleanParsed.shoulderL, keys: { ...DEFAULT_CONTROLLER_CONFIG.shoulderL.keys, ...(cleanParsed.shoulderL?.keys || {}) } },
      shoulderR: { ...DEFAULT_CONTROLLER_CONFIG.shoulderR, ...cleanParsed.shoulderR, keys: { ...DEFAULT_CONTROLLER_CONFIG.shoulderR.keys, ...(cleanParsed.shoulderR?.keys || {}) } },
    };
  } catch (e) {
    return DEFAULT_CONTROLLER_CONFIG;
  }
};

export const saveControllerConfig = (config) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('arcade_ctrl_config', JSON.stringify(config));
    window.dispatchEvent(new Event('arcade_settings_updated'));
  }
};
