import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
export const IDLE_WARNING_THRESHOLD_MS = 60 * 1000; // 60 seconds visual countdown before forced logout

export interface LoginResult {
  success: boolean;
  message?: string;
  error?: string;
  isLocked?: boolean;
  lockedUntil?: number | null;
  remainingSeconds?: number;
  failedAttempts?: number;
  attemptsRemaining?: number;
  isAlreadyLoggedIn?: boolean;
  activeSession?: {
    sessionId?: string;
    device?: string;
    ipAddress?: string;
    timestamp?: string;
  };
  canManagerForceLogout?: boolean;
  isSelfManager?: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  idleTimedOut: boolean;
  sessionRevoked: boolean;
  showIdleWarning: boolean;
  idleWarningSecondsLeft: number;
  extendSession: () => void;
  simulateIdleWarning: () => void;
  clearIdleTimeout: () => void;
  clearSessionRevoked: () => void;
  resetIdleTimer: () => void;
  loginWithPassword: (email: string, password: string, forceLogout?: boolean) => Promise<LoginResult>;
  loginWithPin: (pin: string, email?: string, forceLogout?: boolean, managerPin?: string) => Promise<LoginResult>;
  forceLogoutUser: (params: { targetEmail?: string; sessionId?: string; managerPin?: string; reason?: string }) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUserProfile: (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sipspot_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [idleTimedOut, setIdleTimedOut] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('sipspot_idle_logout') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [sessionRevoked, setSessionRevoked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('sipspot_remote_revoked') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState<number>(60);

  const lastActivityRef = useRef<number>(Date.now());
  const lastSessionCheckRef = useRef<number>(0);
  const lastRedisTouchRef = useRef<number>(0);
  const showIdleWarningRef = useRef<boolean>(false);

  const clearIdleTimeout = useCallback(() => {
    setIdleTimedOut(false);
    try {
      sessionStorage.removeItem('sipspot_idle_logout');
    } catch (e) {}
  }, []);

  const clearSessionRevoked = useCallback(() => {
    setSessionRevoked(false);
    try {
      sessionStorage.removeItem('sipspot_remote_revoked');
    } catch (e) {}
  }, []);

  const resetIdleTimer = useCallback(() => {
    const now = Date.now();
    // Throttle writes to localStorage to avoid performance overhead on continuous mouse movements
    if (now - lastActivityRef.current > 1000) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem('sipspot_last_active', String(now));
      } catch (e) {}
    }

    // Ping /api/auth/touch periodically (every 45 seconds when user is actively interacting) to keep Redis session alive
    if (now - lastRedisTouchRef.current > 45000 && token) {
      lastRedisTouchRef.current = now;
      fetch('/api/auth/touch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, [token]);

  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('sipspot_last_active', String(now));
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(60);

    const currentToken = localStorage.getItem('sipspot_token') || token;
    if (currentToken) {
      lastRedisTouchRef.current = now;
      fetch('/api/auth/touch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});
    }
  }, [token]);

  const simulateIdleWarning = useCallback(() => {
    const now = Date.now();
    const simulatedTime = now - (IDLE_TIMEOUT_MS - 59000);
    lastActivityRef.current = simulatedTime;
    try {
      localStorage.setItem('sipspot_last_active', String(simulatedTime));
    } catch (e) {}
    setShowIdleWarning(true);
    showIdleWarningRef.current = true;
    setIdleWarningSecondsLeft(59);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__triggerIdleWarning = simulateIdleWarning;
    }
  }, [simulateIdleWarning]);

  const handleRemoteRevokedLogout = useCallback(() => {
    try {
      sessionStorage.setItem('sipspot_remote_revoked', 'true');
      sessionStorage.removeItem('sipspot_idle_logout');
      localStorage.removeItem('sipspot_token');
      localStorage.removeItem('sipspot_last_active');
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setSessionRevoked(true);
    setIdleTimedOut(false);
    setToken(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem('sipspot_token') || token;
    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});
    }
    try {
      sessionStorage.removeItem('sipspot_idle_logout');
      sessionStorage.removeItem('sipspot_remote_revoked');
      localStorage.removeItem('sipspot_token');
      localStorage.removeItem('sipspot_last_active');
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(60);
    setIdleTimedOut(false);
    setSessionRevoked(false);
    setToken(null);
    setUser(null);
  }, [token]);

  const handleIdleLogout = useCallback(() => {
    try {
      sessionStorage.setItem('sipspot_idle_logout', 'true');
      localStorage.removeItem('sipspot_token');
      localStorage.removeItem('sipspot_last_active');
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(0);
    setIdleTimedOut(true);
    setToken(null);
    setUser(null);
  }, []);

  const checkRemoteSession = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/check-session', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'SessionRevoked') {
          handleRemoteRevokedLogout();
          return false;
        } else if (data.error === 'SessionTimedOut' || data.idleTimedOut) {
          handleIdleLogout();
          return false;
        }
      }
      return true;
    } catch (e) {
      return true;
    }
  }, [handleRemoteRevokedLogout, handleIdleLogout]);

  // Idle Timer & Activity Listener for 15-minute inactivity security with 60s warning countdown
  useEffect(() => {
    if (!token && !user) {
      setShowIdleWarning(false);
      showIdleWarningRef.current = false;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('sipspot_last_active', String(now));
    } catch (e) {}

    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleUserActivity = () => {
      // If the 60s warning countdown modal is already showing, ignore passive mouse moves/scrolls
      // so user must explicitly click "Extend Session" or press Enter
      if (showIdleWarningRef.current) {
        return;
      }
      resetIdleTimer();
    };

    events.forEach(eventName => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    const checkInactivity = () => {
      if (!token && !user) return;
      const currentTime = Date.now();
      let lastActive = lastActivityRef.current;
      try {
        const stored = localStorage.getItem('sipspot_last_active');
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) {
            lastActive = parsed;
          }
        }
      } catch (e) {}

      const elapsed = currentTime - lastActive;
      const remainingMs = IDLE_TIMEOUT_MS - elapsed;

      // When remaining time is up, trigger automatic logout
      if (remainingMs <= 0) {
        setShowIdleWarning(false);
        showIdleWarningRef.current = false;
        setIdleWarningSecondsLeft(0);
        handleIdleLogout();
        return;
      }

      // When within 60 seconds of timeout, show countdown modal
      if (remainingMs <= IDLE_WARNING_THRESHOLD_MS) {
        const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
        setShowIdleWarning(true);
        showIdleWarningRef.current = true;
        setIdleWarningSecondsLeft(secondsLeft);
      } else {
        if (showIdleWarningRef.current) {
          setShowIdleWarning(false);
          showIdleWarningRef.current = false;
          setIdleWarningSecondsLeft(60);
        }
      }

      // Check remote session revocation every 3.5 seconds
      if (currentTime - lastSessionCheckRef.current >= 3500) {
        lastSessionCheckRef.current = currentTime;
        checkRemoteSession(token);
      }
    };

    // Check every second to provide a smooth, precise second-by-second countdown
    const intervalId = setInterval(checkInactivity, 1000);

    // Prompt check when switching back to the browser tab or unfreezing
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
        if (token) checkRemoteSession(token);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkInactivity);

    return () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkInactivity);
    };
  }, [token, user, resetIdleTimer, handleIdleLogout, checkRemoteSession]);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        if (data.error === 'SessionRevoked') {
          handleRemoteRevokedLogout();
        } else if (data.error === 'SessionTimedOut' || data.idleTimedOut) {
          handleIdleLogout();
        } else {
          // Stale token
          logout();
        }
      }
    } catch (e) {
      console.warn('Auth fetch error, keeping offline session state');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const loginWithPassword = async (email: string, password: string, forceLogout?: boolean) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(forceLogout ? { forceLogout: true } : {}) })
      });
      const data = await res.json();
      if (data.success && data.token) {
        clearIdleTimeout();
        clearSessionRevoked();
        const now = Date.now();
        lastActivityRef.current = now;
        localStorage.setItem('sipspot_token', data.token);
        localStorage.setItem('sipspot_last_active', String(now));
        setToken(data.token);
        setUser(data.user);
        return { success: true, message: data.message };
      }
      return {
        success: false,
        message: data.message || 'Login gagal',
        error: data.error,
        isLocked: data.isLocked,
        lockedUntil: data.lockedUntil,
        remainingSeconds: data.remainingSeconds,
        failedAttempts: data.failedAttempts,
        attemptsRemaining: data.attemptsRemaining,
        isAlreadyLoggedIn: data.isAlreadyLoggedIn,
        activeSession: data.activeSession,
        canManagerForceLogout: data.canManagerForceLogout,
        isSelfManager: data.isSelfManager,
        user: data.user
      };
    } catch (err: any) {
      return { success: false, message: 'Koneksi ke server gagal' };
    }
  };

  const loginWithPin = async (pin: string, email?: string, forceLogout?: boolean, managerPin?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          ...(email ? { email } : {}),
          ...(forceLogout ? { forceLogout: true } : {}),
          ...(managerPin ? { managerPin } : {})
        })
      });
      const data = await res.json();
      if (data.success && data.token) {
        clearIdleTimeout();
        clearSessionRevoked();
        const now = Date.now();
        lastActivityRef.current = now;
        localStorage.setItem('sipspot_token', data.token);
        localStorage.setItem('sipspot_last_active', String(now));
        setToken(data.token);
        setUser(data.user);
        return { success: true, message: data.message };
      }
      return {
        success: false,
        message: data.message || 'PIN tidak valid',
        error: data.error,
        isLocked: data.isLocked,
        lockedUntil: data.lockedUntil,
        remainingSeconds: data.remainingSeconds,
        failedAttempts: data.failedAttempts,
        attemptsRemaining: data.attemptsRemaining,
        isAlreadyLoggedIn: data.isAlreadyLoggedIn,
        activeSession: data.activeSession,
        canManagerForceLogout: data.canManagerForceLogout,
        isSelfManager: data.isSelfManager,
        user: data.user
      };
    } catch (err: any) {
      return { success: false, message: 'Koneksi ke server gagal' };
    }
  };

  const forceLogoutUser = async (params: { targetEmail?: string; sessionId?: string; managerPin?: string; reason?: string }) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/force-logout', {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });
      const data = await res.json();
      return {
        success: !!data.success,
        message: data.message || (data.success ? 'Berhasil memutus sesi pengguna' : 'Gagal memutus sesi')
      };
    } catch (e: any) {
      return { success: false, message: 'Koneksi ke server gagal' };
    }
  };

  const updateUserProfile = async (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => {
    if (!token) return { success: false, message: 'Belum login' };
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (resData.success) {
        if (resData.user) {
          setUser(prev => prev ? { ...prev, ...resData.user } : resData.user);
        }
        return { success: true, message: resData.message };
      }
      return { success: false, message: resData.message || 'Gagal update profil' };
    } catch (err) {
      return { success: false, message: 'Gagal memperbarui profil' };
    }
  };

  const refreshUser = async () => {
    if (token) await fetchCurrentUser(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        idleTimedOut,
        sessionRevoked,
        showIdleWarning,
        idleWarningSecondsLeft,
        extendSession,
        simulateIdleWarning,
        clearIdleTimeout,
        clearSessionRevoked,
        resetIdleTimer,
        loginWithPassword,
        loginWithPin,
        forceLogoutUser,
        logout,
        updateUserProfile,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
