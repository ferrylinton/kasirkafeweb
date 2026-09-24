/**
 * Device & Browser Fingerprinting Utility for KasirKafe POS
 * Generates unique device identifier and browser metadata for JWT binding and server-side validation.
 */

// Generate a random UUID v4 fallback if crypto.randomUUID is not available
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Simple fast string hashing (DJB2 + FNV-1a hybrid) to create deterministic fingerprint
function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function parseClientBrowserAndOS(): { browser: string; os: string } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { browser: 'Unknown Browser', os: 'Unknown OS' };
  }

  const ua = navigator.userAgent;
  let browser = 'Web Browser';
  if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  let os = 'Desktop';
  if (ua.includes('Windows')) os = 'Windows PC';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android Mobile';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
  else if (ua.includes('Linux')) os = 'Linux';

  return { browser, os };
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server_mock_id';
  try {
    let deviceId = localStorage.getItem('kasirkafe_device_id');
    if (!deviceId) {
      deviceId = `dev_${generateUUID().replace(/-/g, '').substring(0, 16)}`;
      localStorage.setItem('kasirkafe_device_id', deviceId);
    }
    return deviceId;
  } catch (e) {
    return 'temp_device_id';
  }
}

export interface DeviceMetadata {
  fingerprint: string;
  deviceId: string;
  userAgent: string;
  platform: string;
  screenResolution: string;
  language: string;
  timezone: string;
  browser: string;
  os: string;
  deviceSummary: string;
}

export function getDeviceMetadata(): DeviceMetadata {
  if (typeof window === 'undefined') {
    return {
      fingerprint: 'fp_default_server',
      deviceId: 'dev_default',
      userAgent: 'Server',
      platform: 'Server',
      screenResolution: '1920x1080',
      language: 'id-ID',
      timezone: 'Asia/Jakarta',
      browser: 'Web Browser',
      os: 'Desktop',
      deviceSummary: 'Web Browser on Desktop'
    };
  }

  const deviceId = getDeviceId();
  const userAgent = navigator.userAgent || 'Unknown';
  const platform = navigator.platform || 'Unknown';
  const screenResolution = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 24}`;
  const language = navigator.language || 'id-ID';
  let timezone = 'Asia/Jakarta';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
  } catch (e) {}

  const { browser, os } = parseClientBrowserAndOS();

  // Deterministic hardware & browser fingerprint
  const rawFingerprintString = `${deviceId}|${browser}|${os}|${platform}|${screenResolution}|${timezone}|${language}`;
  const hash = hashString(rawFingerprintString);
  const fingerprint = `fp_${deviceId.substring(4, 10)}_${hash.substring(0, 10)}`;

  const deviceSummary = `${browser} on ${os} (${timezone})`;

  return {
    fingerprint,
    deviceId,
    userAgent,
    platform,
    screenResolution,
    language,
    timezone,
    browser,
    os,
    deviceSummary
  };
}

export function getDeviceFingerprint(): string {
  return getDeviceMetadata().fingerprint;
}

/**
 * Initializes global fetch interceptor to automatically inject x-device-fingerprint
 * into all outbound requests to /api/
 */
let isInterceptorInitialized = false;

export function initDeviceFingerprintInterceptor() {
  if (typeof window === 'undefined' || isInterceptorInitialized) return;
  isInterceptorInitialized = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const urlString = typeof input === 'string'
        ? input
        : (input instanceof URL ? input.toString() : (input as Request).url);

      if (urlString && (urlString.startsWith('/api') || urlString.includes('/api/'))) {
        const metadata = getDeviceMetadata();
        init = init || {};
        const headers = new Headers(init.headers || {});

        if (!headers.has('x-device-fingerprint')) {
          headers.set('x-device-fingerprint', metadata.fingerprint);
        }
        if (!headers.has('x-device-id')) {
          headers.set('x-device-id', metadata.deviceId);
        }

        init.headers = headers;
      }
    } catch (e) {
      // Fallback silently if header attachment encounters error
    }

    return originalFetch.call(this, input, init);
  };
}
