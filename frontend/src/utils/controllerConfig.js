export const DEFAULT_CONTROLLER_CONFIG = {
  opacity: 0.8,
  joystick: { 
    left: 10, top: 60, scale: 1, 
    keys: { up: 'w', down: 's', left: 'a', right: 'd' } 
  },
  actions: { 
    left: 70, top: 60, scale: 1, 
    keys: { a: 'arrowup', b: 'arrowleft', x: 'arrowdown', y: 'arrowright' } 
  },
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
    // Merge deeply to handle any missing fields from older versions
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_CONTROLLER_CONFIG,
      ...parsed,
      joystick: { ...DEFAULT_CONTROLLER_CONFIG.joystick, ...parsed.joystick, keys: { ...DEFAULT_CONTROLLER_CONFIG.joystick.keys, ...(parsed.joystick?.keys || {}) } },
      actions: { ...DEFAULT_CONTROLLER_CONFIG.actions, ...parsed.actions, keys: { ...DEFAULT_CONTROLLER_CONFIG.actions.keys, ...(parsed.actions?.keys || {}) } },
      system: { ...DEFAULT_CONTROLLER_CONFIG.system, ...parsed.system, keys: { ...DEFAULT_CONTROLLER_CONFIG.system.keys, ...(parsed.system?.keys || {}) } },
      shoulderL: { ...DEFAULT_CONTROLLER_CONFIG.shoulderL, ...parsed.shoulderL, keys: { ...DEFAULT_CONTROLLER_CONFIG.shoulderL.keys, ...(parsed.shoulderL?.keys || {}) } },
      shoulderR: { ...DEFAULT_CONTROLLER_CONFIG.shoulderR, ...parsed.shoulderR, keys: { ...DEFAULT_CONTROLLER_CONFIG.shoulderR.keys, ...(parsed.shoulderR?.keys || {}) } },
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
