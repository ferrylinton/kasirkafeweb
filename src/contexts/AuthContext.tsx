import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User } from '../types';
import { getDeviceMetadata } from '../utils/deviceFingerprint';

// 30 seconds of inactivity idle timeout
export const IDLE_TIMEOUT_MS = 60 * 1000;
// 10 seconds visual countdown before forced logout
export const IDLE_WARNING_THRESHOLD_MS = 10 * 1000;

export interface LoginResult {
  success: boolean;
  message?: string;
  previousSessionsTerminated?: boolean;
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
  vendorDeactivated?: boolean;
  vendorName?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

/**
 * Extracts remaining lifetime of a JWT token in seconds
 */
export function getJwtRemainingSeconds(jwtToken: string): number {
  try {
    const parts = jwtToken.split('.');
    if (parts.length < 2) return 0;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    return parsed.exp - nowSec;
  } catch (e) {
    return 0;
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
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
  refreshAccessToken: () => Promise<string | null>;
  loginWithPassword: (email: string, password: string, forceLogout?: boolean) => Promise<LoginResult>;
  forceLogoutUser: (params: { targetEmail?: string; sessionId?: string; managerEmail?: string; managerPassword?: string; reason?: string }) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUserProfile: (data: { name?: string; avatar?: string; currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kasirkafe_token');
    } catch {
      return null;
    }
  });
  const [refreshToken, setRefreshToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kasirkafe_refresh_token');
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [idleTimedOut, setIdleTimedOut] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('kasirkafe_idle_logout') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [sessionRevoked, setSessionRevoked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('kasirkafe_remote_revoked') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showIdleWarning, setShowIdleWarning] = useState<boolean>(false);
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState<number>(10);

  const lastActivityRef = useRef<number>(Date.now());
  const lastSessionCheckRef = useRef<number>(0);
  const lastRedisTouchRef = useRef<number>(0);
  const lastRefreshCheckRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
  const showIdleWarningRef = useRef<boolean>(false);

  const clearIdleTimeout = useCallback(() => {
    setIdleTimedOut(false);
    try {
      sessionStorage.removeItem('kasirkafe_idle_logout');
    } catch (e) {}
  }, []);

  const clearSessionRevoked = useCallback(() => {
    setSessionRevoked(false);
    try {
      sessionStorage.removeItem('kasirkafe_remote_revoked');
    } catch (e) {}
  }, []);

  const handleRemoteRevokedLogout = useCallback(() => {
    try {
      sessionStorage.setItem('kasirkafe_remote_revoked', 'true');
      sessionStorage.removeItem('kasirkafe_idle_logout');
      localStorage.removeItem('kasirkafe_token');
      localStorage.removeItem('kasirkafe_refresh_token');
      localStorage.removeItem('kasirkafe_last_active');
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setSessionRevoked(true);
    setIdleTimedOut(false);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const handleIdleLogout = useCallback(() => {
    const currentToken = localStorage.getItem('kasirkafe_token') || token;
    // Explicitly notify backend to invalidate token and session on 30-second idle timeout
    if (currentToken) {
      fetch('/api/auth/invalidate-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        },
        body: JSON.stringify({ token: currentToken })
      }).catch(() => {});
    }

    try {
      sessionStorage.setItem('kasirkafe_idle_logout', 'true');
      sessionStorage.removeItem('kasirkafe_remote_revoked');
      localStorage.removeItem('kasirkafe_token');
      localStorage.removeItem('kasirkafe_refresh_token');
      localStorage.removeItem('kasirkafe_last_active');
    } catch (e) {}

    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(0);
    setIdleTimedOut(true);
    setSessionRevoked(false);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [token]);

  const logout = useCallback(() => {
    const currentToken = localStorage.getItem('kasirkafe_token') || token;
    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});
    }
    try {
      sessionStorage.removeItem('kasirkafe_idle_logout');
      sessionStorage.removeItem('kasirkafe_remote_revoked');
      localStorage.removeItem('kasirkafe_token');
      localStorage.removeItem('kasirkafe_refresh_token');
      localStorage.removeItem('kasirkafe_last_active');
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(10);
    setIdleTimedOut(false);
    setSessionRevoked(false);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [token]);

  /**
   * Refreshes the Access Token using the stored Refresh Token and device fingerprint
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (isRefreshingRef.current) return null;
    const currentRefreshToken = localStorage.getItem('kasirkafe_refresh_token');
    if (!currentRefreshToken) return null;

    isRefreshingRef.current = true;
    try {
      const metadata = getDeviceMetadata();
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': metadata.fingerprint,
          'X-Device-Id': metadata.deviceId
        },
        body: JSON.stringify({
          refreshToken: currentRefreshToken,
          deviceFingerprint: metadata.fingerprint
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.token) {
        localStorage.setItem('kasirkafe_token', data.token);
        setToken(data.token);
        if (data.refreshToken) {
          localStorage.setItem('kasirkafe_refresh_token', data.refreshToken);
          setRefreshToken(data.refreshToken);
        }
        if (data.user) {
          setUser(prev => prev ? { ...prev, ...data.user } : data.user);
        }
        return data.token;
      } else {
        if (data.error === 'SessionRevoked' || data.error === 'DeviceMismatch') {
          handleRemoteRevokedLogout();
        } else if (data.error === 'SessionTimedOut' || data.idleTimedOut) {
          handleIdleLogout();
        }
        return null;
      }
    } catch (err) {
      console.warn('[Auth] Token refresh warning, maintaining local state');
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [handleRemoteRevokedLogout, handleIdleLogout]);

  /**
   * Activity listener handler:
   * - Resets idle timer on user action
   * - Inspects JWT token remaining time; if < 1 minute (60s), refreshes access token from backend
   * - Pings /api/auth/touch periodically to keep session alive in Redis
   */
  const resetIdleTimer = useCallback(() => {
    const now = Date.now();
    // Throttle writes to localStorage to avoid performance overhead on continuous mouse movements
    if (now - lastActivityRef.current > 500) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem('kasirkafe_last_active', String(now));
      } catch (e) {}
    }

    // Proactive JWT token inspection on user activity:
    // If token has less than 1 minute remaining (<= 60s), refresh it from backend
    if (now - lastRefreshCheckRef.current > 2000) {
      lastRefreshCheckRef.current = now;
      const currentToken = localStorage.getItem('kasirkafe_token') || token;
      if (currentToken) {
        const remainingSec = getJwtRemainingSeconds(currentToken);
        if (remainingSec > 0 && remainingSec <= 60 && !isRefreshingRef.current) {
          refreshAccessToken();
        }
      }
    }

    // Ping /api/auth/touch periodically (every 10 seconds of user activity) to keep Redis session alive
    if (now - lastRedisTouchRef.current > 10000 && token) {
      lastRedisTouchRef.current = now;
      fetch('/api/auth/touch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }, [token, refreshAccessToken]);

  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('kasirkafe_last_active', String(now));
    } catch (e) {}
    setShowIdleWarning(false);
    showIdleWarningRef.current = false;
    setIdleWarningSecondsLeft(10);

    const currentToken = localStorage.getItem('kasirkafe_token') || token;
    if (currentToken) {
      lastRedisTouchRef.current = now;
      fetch('/api/auth/touch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` }
      }).catch(() => {});

      // Check remaining lifetime and refresh if < 60s
      const remainingSec = getJwtRemainingSeconds(currentToken);
      if (remainingSec > 0 && remainingSec <= 60) {
        refreshAccessToken();
      }
    }
  }, [token, refreshAccessToken]);

  const simulateIdleWarning = useCallback(() => {
    const now = Date.now();
    // Simulate being at 9 seconds left before 30-second timeout
    const simulatedTime = now - (IDLE_TIMEOUT_MS - 9000);
    lastActivityRef.current = simulatedTime;
    try {
      localStorage.setItem('kasirkafe_last_active', String(simulatedTime));
    } catch (e) {}
    setShowIdleWarning(true);
    showIdleWarningRef.current = true;
    setIdleWarningSecondsLeft(9);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__triggerIdleWarning = simulateIdleWarning;
    }
  }, [simulateIdleWarning]);

  const checkRemoteSession = useCallback(async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/check-session', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'SessionRevoked' || data.error === 'DeviceMismatch') {
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

  // Idle Timer & Activity Listener for 30-second inactivity security with 10s warning countdown
  useEffect(() => {
    if (!token && !user) {
      setShowIdleWarning(false);
      showIdleWarningRef.current = false;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem('kasirkafe_last_active', String(now));
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
      // If the 10s warning countdown modal is already showing, ignore passive mouse moves/scrolls
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
        const stored = localStorage.getItem('kasirkafe_last_active');
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > 0) {
            lastActive = parsed;
          }
        }
      } catch (e) {}

      const elapsed = currentTime - lastActive;
      const remainingMs = IDLE_TIMEOUT_MS - elapsed;

      // When 30-second idle limit is exceeded, immediately trigger automatic logout and invalidate access token
      if (remainingMs <= 0) {
        setShowIdleWarning(false);
        showIdleWarningRef.current = false;
        setIdleWarningSecondsLeft(0);
        handleIdleLogout();
        return;
      }

      // When within 10 seconds of timeout, show countdown modal
      if (remainingMs <= IDLE_WARNING_THRESHOLD_MS) {
        const secondsLeft = Math.max(1, Math.ceil(remainingMs / 1000));
        setShowIdleWarning(true);
        showIdleWarningRef.current = true;
        setIdleWarningSecondsLeft(secondsLeft);
      } else {
        if (showIdleWarningRef.current) {
          setShowIdleWarning(false);
          showIdleWarningRef.current = false;
          setIdleWarningSecondsLeft(10);
        }
      }

      // Check remote session revocation every 3.5 seconds
      if (currentTime - lastSessionCheckRef.current >= 3500) {
        lastSessionCheckRef.current = currentTime;
        checkRemoteSession(token || '');
      }
    };

    // Check every 500ms for accurate and responsive 30-second timeout tracking
    const intervalId = setInterval(checkInactivity, 500);

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
      // Check if token has < 60s remaining; if so, refresh first
      const remSec = getJwtRemainingSeconds(authToken);
      if (remSec > 0 && remSec <= 60) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          authToken = refreshedToken;
        }
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        if (data.error === 'SessionRevoked' || data.error === 'DeviceMismatch') {
          handleRemoteRevokedLogout();
        } else if (data.error === 'SessionTimedOut' || data.idleTimedOut) {
          handleIdleLogout();
        } else {
          // Attempt refresh once before logging out
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            logout();
          }
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
      const metadata = getDeviceMetadata();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Fingerprint': metadata.fingerprint,
          'X-Device-Id': metadata.deviceId
        },
        body: JSON.stringify({
          email,
          password,
          deviceFingerprint: metadata.fingerprint,
          ...(forceLogout ? { forceLogout: true } : {})
        })
      });
      const data = await res.json();
      if (data.success && data.token) {
        clearIdleTimeout();
        clearSessionRevoked();
        const now = Date.now();
        lastActivityRef.current = now;
        localStorage.setItem('kasirkafe_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('kasirkafe_refresh_token', data.refreshToken);
          setRefreshToken(data.refreshToken);
        }
        localStorage.setItem('kasirkafe_last_active', String(now));
        setToken(data.token);
        setUser(data.user);
        return { success: true, message: data.message, previousSessionsTerminated: data.previousSessionsTerminated };
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
        vendorDeactivated: data.vendorDeactivated,
        vendorName: data.vendorName,
        user: data.user
      };
    } catch (err: any) {
      return { success: false, message: 'Koneksi ke server gagal' };
    }
  };

  const forceLogoutUser = async (params: { targetEmail?: string; sessionId?: string; managerEmail?: string; managerPassword?: string; reason?: string }) => {
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
        refreshToken,
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
        refreshAccessToken,
        loginWithPassword,
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
