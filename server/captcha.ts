import crypto from 'crypto';
import { getRedisClient } from './redis';

// Captcha lifetime: 5 minutes (in milliseconds)
export const CAPTCHA_TTL_MS = 5 * 60 * 1000;
export const CAPTCHA_TTL_SECONDS = 300;

// Character set: Uppercase letters & numbers
// Omits visually ambiguous characters (0, O, 1, I) to ensure optimal user experience
const CAPTCHA_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

interface CaptchaEntry {
  answer: string;
  expiresAt: number;
}

// In-memory fallback map
const memoryCaptchaStore = new Map<string, CaptchaEntry>();

// Periodic memory cleaner (every 1 minute)
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of memoryCaptchaStore.entries()) {
    if (now > entry.expiresAt) {
      memoryCaptchaStore.delete(token);
    }
  }
}, 60 * 1000);

/**
 * Random code generator using uppercase letters and numbers
 */
function randomCaptchaText(length = 5): string {
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CAPTCHA_CHARS[randomBytes[i] % CAPTCHA_CHARS.length];
  }
  return result;
}

/**
 * Generate aesthetically pleasing SVG Captcha image with noise and character distortion
 */
function generateCaptchaSvg(text: string): string {
  const width = 180;
  const height = 52;
  const colors = ['#ae3115', '#9a3412', '#78350f', '#0f766e', '#1c1917', '#c2410c', '#374151'];

  // Generate decorative noise lines (bezier curves)
  const lines: string[] = [];
  for (let i = 0; i < 3; i++) {
    const startY = 10 + Math.random() * 32;
    const endY = 10 + Math.random() * 32;
    const cp1X = 30 + Math.random() * 50;
    const cp1Y = 5 + Math.random() * 42;
    const cp2X = 100 + Math.random() * 50;
    const cp2Y = 5 + Math.random() * 42;
    const stroke = colors[i % colors.length];
    const strokeWidth = 1.2 + Math.random() * 0.8;
    lines.push(
      `<path d="M 0,${startY.toFixed(1)} C ${cp1X.toFixed(1)},${cp1Y.toFixed(1)} ${cp2X.toFixed(1)},${cp2Y.toFixed(1)} ${width},${endY.toFixed(1)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(1)}" fill="none" opacity="0.35" />`
    );
  }

  // Generate decorative noise dots
  const dots: string[] = [];
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = 0.8 + Math.random() * 1.4;
    const color = colors[i % colors.length];
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.25" />`);
  }

  // Generate characters with individual translation and rotation
  const charSpacing = (width - 36) / text.length;
  const charElements: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charX = 18 + i * charSpacing + (Math.random() * 6 - 3);
    const charY = 34 + (Math.random() * 6 - 3);
    const angle = (Math.random() * 26 - 13).toFixed(1);
    const color = colors[(i * 2 + 1) % colors.length];
    const fontSize = 24 + Math.floor(Math.random() * 6);

    charElements.push(
      `<text x="${charX.toFixed(1)}" y="${charY.toFixed(1)}" font-family="'Courier New', Courier, monospace, sans-serif" font-size="${fontSize}" font-weight="900" fill="${color}" transform="rotate(${angle}, ${charX.toFixed(1)}, ${charY.toFixed(1)})" letter-spacing="2">${char}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="captchaBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff8f4" />
        <stop offset="50%" stop-color="#fdf4ee" />
        <stop offset="100%" stop-color="#fff0e8" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="12" fill="url(#captchaBg)" stroke="#e7e5e4" stroke-width="1" />
    ${lines.join('')}
    ${dots.join('')}
    ${charElements.join('')}
  </svg>`;
}

/**
 * Creates a new Captcha with 5-minute validity, stored in Redis (with local fallback)
 */
export async function createCaptcha(): Promise<{
  token: string;
  image: string; // Base64 data URL of SVG
  expiresAt: number;
  expiresInSeconds: number;
}> {
  const token = `cap_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const answer = randomCaptchaText(5);
  const now = Date.now();
  const expiresAt = now + CAPTCHA_TTL_MS;

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(
        `captcha:${token}`,
        CAPTCHA_TTL_SECONDS,
        JSON.stringify({ answer, expiresAt })
      );
    } catch (e) {
      // Fallback to local memory
      memoryCaptchaStore.set(token, { answer, expiresAt });
    }
  } else {
    memoryCaptchaStore.set(token, { answer, expiresAt });
  }

  const svg = generateCaptchaSvg(answer);
  const base64Svg = Buffer.from(svg).toString('base64');
  const image = `data:image/svg+xml;base64,${base64Svg}`;

  return {
    token,
    image,
    expiresAt,
    expiresInSeconds: CAPTCHA_TTL_SECONDS
  };
}

/**
 * Validates a captcha token and answer.
 * Enforces:
 * - Token existence
 * - 5-minute TTL expiration
 * - Case-insensitive match of uppercase alphanumeric characters
 * - Single-use consumption (invalidated immediately to prevent replay)
 */
export async function verifyCaptcha(
  token?: string | null,
  answer?: string | null
): Promise<{ valid: boolean; message?: string }> {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      message: 'Kode captcha wajib diverifikasi. Silakan isi kode captcha.'
    };
  }

  if (!answer || typeof answer !== 'string' || !answer.trim()) {
    return {
      valid: false,
      message: 'Kode captcha tidak boleh kosong.'
    };
  }

  const cleanToken = token.trim();
  const cleanAnswer = answer.trim().toUpperCase();
  const redis = getRedisClient();

  let entry: CaptchaEntry | null = null;

  if (redis) {
    try {
      const data = await redis.get(`captcha:${cleanToken}`);
      if (data) {
        entry = JSON.parse(data);
        // Consume token immediately (one-time use)
        await redis.del(`captcha:${cleanToken}`).catch(() => {});
      }
    } catch (e) {
      // Check memory store fallback
      entry = memoryCaptchaStore.get(cleanToken) || null;
      if (entry) memoryCaptchaStore.delete(cleanToken);
    }
  } else {
    entry = memoryCaptchaStore.get(cleanToken) || null;
    if (entry) {
      // Consume token immediately
      memoryCaptchaStore.delete(cleanToken);
    }
  }

  if (!entry) {
    return {
      valid: false,
      message: 'Kode captcha tidak ditemukan atau telah digunakan. Silakan muat ulang captcha baru.'
    };
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    return {
      valid: false,
      message: 'Kode captcha telah kadaluwarsa (masa aktif 5 menit). Silakan klik muat ulang untuk kode baru.'
    };
  }

  if (entry.answer.toUpperCase() !== cleanAnswer) {
    return {
      valid: false,
      message: 'Kode captcha yang Anda masukkan salah. Periksa huruf besar dan angka dengan teliti.'
    };
  }

  return { valid: true };
}
