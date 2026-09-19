import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { getDB, fallbackStore } from './db';
import { ObjectId } from 'mongodb';

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST || 'mail.marmeam.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER || 'noreplay@marmeam.com';
const SMTP_PASS = process.env.SMTP_PASS || 'noreplay123456';
const SMTP_FROM = process.env.SMTP_FROM || 'GlobalScript 123 <noreplay@marmeam.com>';

let transporter: Transporter | null = null;

try {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000
  });
} catch (err: any) {
  console.warn('[SMTP] Transport init warning:', err.message);
}

export interface EmailLogEntry {
  _id?: any;
  orderId?: string;
  orderNumber?: string;
  recipientEmail: string;
  subject: string;
  templateCode: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  messageId?: string;
  sentAt: Date;
}

export interface TemplateVariables {
  [key: string]: string | number;
}

/**
 * Fetch email template from database with fallback
 */
export async function getTemplateByCode(code: string): Promise<{ subject: string; bodyHtml: string } | null> {
  const db = getDB();
  if (db) {
    try {
      const tmpl = await db.collection('email_templates').findOne({ code, isActive: true });
      if (tmpl) {
        return { subject: tmpl.subject, bodyHtml: tmpl.bodyHtml };
      }
    } catch (e) {
      // Fallback
    }
  }

  const fallbackTmpl = fallbackStore.email_templates.find((t) => t.code === code);
  if (fallbackTmpl) {
    return { subject: fallbackTmpl.subject, bodyHtml: fallbackTmpl.bodyHtml };
  }

  return null;
}

/**
 * Replace placeholders like {{orderNumber}}, {{customerName}}
 */
export function interpolateTemplate(text: string, variables: TemplateVariables): string {
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : '';
  });
}

/**
 * Send email, save log to database
 */
export async function sendReceiptEmail(params: {
  recipientEmail: string;
  orderId: string;
  orderNumber: string;
  variables: TemplateVariables;
  customSubject?: string;
}): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { recipientEmail, orderId, orderNumber, variables, customSubject } = params;

  // Retrieve template
  const template = await getTemplateByCode('RECEIPT_EMAIL');
  const subjectTemplate = customSubject || template?.subject || 'Struk Transaksi SipSpot POS - #{{orderNumber}}';
  const bodyTemplate = template?.bodyHtml || getDefaultReceiptHtml();

  const finalSubject = interpolateTemplate(subjectTemplate, variables);
  const finalHtml = interpolateTemplate(bodyTemplate, variables);

  let status: 'success' | 'failed' = 'failed';
  let errorMessage: string | undefined;
  let messageId: string | undefined;

  try {
    if (!transporter) {
      throw new Error('Transporter SMTP tidak terkonfigurasi');
    }

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: recipientEmail,
      subject: finalSubject,
      html: finalHtml
    });

    status = 'success';
    messageId = info.messageId;
    console.log(`[SMTP] Email sent successfully to ${recipientEmail}, MessageId: ${messageId}`);
  } catch (err: any) {
    status = 'failed';
    errorMessage = err.message || 'SMTP delivery failed';
    console.warn(`[SMTP] Failed to send email to ${recipientEmail}:`, errorMessage);
  }

  // Record log into database
  const logData: EmailLogEntry = {
    orderId,
    orderNumber,
    recipientEmail,
    subject: finalSubject,
    templateCode: 'RECEIPT_EMAIL',
    status,
    errorMessage,
    messageId,
    sentAt: new Date()
  };

  const db = getDB();
  let logId: string = new ObjectId().toString();

  if (db) {
    try {
      const res = await db.collection('email_logs').insertOne(logData);
      logId = res.insertedId.toString();

      // Also update order with latest email status
      await db.collection('orders').updateOne(
        { orderNumber },
        {
          $set: {
            emailStatus: status,
            emailSentAt: new Date(),
            lastEmailError: errorMessage || null
          }
        }
      );
    } catch (dbErr) {
      console.warn('[SMTP] Could not save email log to MongoDB, saving in local store');
      fallbackStore.email_logs.unshift({ ...logData, _id: logId });
    }
  } else {
    fallbackStore.email_logs.unshift({ ...logData, _id: logId });
  }

  return {
    success: status === 'success',
    error: errorMessage,
    logId
  };
}

function getDefaultReceiptHtml(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #fff8f6; color: #221a18; padding: 20px; }
    .card { background-color: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 16px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 2px dashed #f0dfdb; padding-bottom: 16px; margin-bottom: 16px; }
    .title { color: #ae3115; font-size: 22px; font-weight: bold; margin: 0; }
    .subtitle { color: #59413c; font-size: 13px; margin-top: 4px; }
    .meta { font-size: 12px; color: #59413c; margin: 12px 0; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .table th { text-align: left; padding: 8px 4px; border-bottom: 1px solid #f0dfdb; color: #59413c; }
    .table td { padding: 8px 4px; border-bottom: 1px solid #fbf0ee; }
    .total-row { font-size: 16px; font-weight: bold; color: #ae3115; }
    .footer { text-align: center; font-size: 12px; color: #8d716a; margin-top: 20px; border-top: 1px solid #f0dfdb; padding-top: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">SipSpot Beverage & Snack</div>
      <div class="subtitle">Artisan Coffee, Fresh Tea & Healthy Juice</div>
      <div class="meta">
        <strong>Order: #{{orderNumber}}</strong> | {{date}}<br>
        Pelanggan: {{customerName}} | Kasir: {{cashierName}}
      </div>
    </div>
    
    <div>
      {{itemsTable}}
    </div>

    <table style="width: 100%; margin-top: 12px; font-size: 14px;">
      <tr>
        <td>Subtotal:</td>
        <td style="text-align: right;"><strong>{{subtotal}}</strong></td>
      </tr>
      <tr>
        <td>Diskon / Promo:</td>
        <td style="text-align: right; color: #006c49;"><strong>{{discount}}</strong></td>
      </tr>
      <tr>
        <td>Pajak PB1 (10%):</td>
        <td style="text-align: right;"><strong>{{tax}}</strong></td>
      </tr>
      <tr class="total-row">
        <td style="padding-top: 8px; font-size: 18px;">Total Akhir:</td>
        <td style="text-align: right; padding-top: 8px; font-size: 18px; color: #ae3115;">{{total}}</td>
      </tr>
      <tr>
        <td>Metode Bayar:</td>
        <td style="text-align: right;">{{paymentMethod}}</td>
      </tr>
      <tr>
        <td>Kembalian:</td>
        <td style="text-align: right; color: #006c49;">{{change}}</td>
      </tr>
    </table>

    <div class="footer">
      Terima kasih telah berkunjung ke SipSpot!<br>
      Semoga harimu menyenangkan dan penuh kesegaran ☕✨
    </div>
  </div>
</body>
</html>
  `;
}

export function parseUserAgent(ua?: string): string {
  if (!ua) return 'Perangkat Tidak Dikenal';
  let browser = 'Browser Web';
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

  return `${browser} (${os})`;
}

/**
 * Send security email alert upon new login with remote logout button
 */
export async function sendLoginAlertEmail(params: {
  recipientEmail: string;
  userName: string;
  role: string;
  loginMethod: 'PIN' | 'PASSWORD';
  ipAddress: string;
  userAgent?: string;
  device?: string;
  sessionId: string;
  revokeToken: string;
  appUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    recipientEmail,
    userName,
    role,
    loginMethod,
    ipAddress,
    userAgent,
    device = parseUserAgent(userAgent),
    sessionId,
    revokeToken,
    appUrl
  } = params;

  const revokeUrl = `${appUrl.replace(/\/$/, '')}/api/auth/revoke-session?token=${encodeURIComponent(
    revokeToken
  )}&session=${encodeURIComponent(sessionId)}`;

  const nowFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  const methodLabel = loginMethod === 'PIN' ? 'PIN Cepat Kasir (4 Digit)' : 'Email & Password';

  const subject = `[Keamanan SipSpot] Notifikasi Login Baru - Akun ${userName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff8f6; color: #221a18; padding: 24px 12px; margin: 0; }
    .card { background-color: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 20px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #f2dfdc; }
    .header { text-align: center; border-bottom: 2px solid #fbf0ee; padding-bottom: 20px; margin-bottom: 22px; }
    .logo-badge { display: inline-block; background: #fff0ec; color: #ae3115; font-weight: 800; font-size: 14px; padding: 6px 14px; border-radius: 9999px; margin-bottom: 10px; }
    .title { color: #221a18; font-size: 20px; font-weight: bold; margin: 0 0 6px 0; }
    .subtitle { color: #785a53; font-size: 13px; margin: 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; background-color: #fdfaf9; border-radius: 12px; overflow: hidden; border: 1px solid #f5e4e1; }
    .info-table td { padding: 10px 14px; border-bottom: 1px solid #f5e4e1; }
    .info-table tr:last-child td { border-bottom: none; }
    .label { color: #80635d; font-weight: 600; width: 38%; }
    .val { color: #1a1514; font-weight: 700; }
    .alert-box { background-color: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 14px; padding: 18px; margin: 24px 0 16px 0; text-align: center; }
    .alert-title { color: #991b1b; font-size: 14px; font-weight: 800; margin: 0 0 8px 0; }
    .alert-desc { color: #7f1d1d; font-size: 12px; line-height: 1.5; margin: 0 0 16px 0; }
    .btn-revoke { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 13px; padding: 12px 24px; border-radius: 10px; box-shadow: 0 3px 10px rgba(220,38,38,0.25); text-align: center; }
    .footer { text-align: center; font-size: 11px; color: #a18680; margin-top: 24px; border-top: 1px solid #fbf0ee; padding-top: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo-badge">☕ SipSpot POS Security</div>
      <h2 class="title">Notifikasi Login Baru</h2>
      <p class="subtitle">Kami mendeteksi aktivitas login baru pada akun kasir Anda</p>
    </div>

    <p style="font-size: 13px; line-height: 1.5; margin-bottom: 14px; color: #433431;">
      Halo <strong>${userName}</strong>,<br>
      Akun staf Anda dengan peran <strong>${role}</strong> baru saja berhasil masuk ke sistem SipSpot POS. Berikut rincian aktivitasnya:
    </p>

    <table class="info-table">
      <tr>
        <td class="label">Waktu Login</td>
        <td class="val">${nowFormatted}</td>
      </tr>
      <tr>
        <td class="label">Metode Otentikasi</td>
        <td class="val">${methodLabel}</td>
      </tr>
      <tr>
        <td class="label">Perangkat & Browser</td>
        <td class="val">${device}</td>
      </tr>
      <tr>
        <td class="label">Alamat IP</td>
        <td class="val"><code>${ipAddress}</code></td>
      </tr>
      <tr>
        <td class="label">Status Sesi</td>
        <td class="val" style="color: #059669;">● Sedang Aktif</td>
      </tr>
    </table>

    <div class="alert-box">
      <div class="alert-title">⚠️ Bukan Anda yang login?</div>
      <p class="alert-desc">
        Jika Anda tidak mengenali aktivitas ini atau menduga orang lain menggunakan akun Anda tanpa izin, segera amankan akun Anda sekarang dengan memutuskan sesi perangkat tersebut:
      </p>
      <a href="${revokeUrl}" target="_blank" class="btn-revoke">
        KELUARKAN / LOGOUT SESI INI DARI JAUH
      </a>
      <p style="font-size: 11px; color: #991b1b; margin-top: 12px; margin-bottom: 0;">
        (Tautan ini akan langsung memutus sesi tersebut dan memaksanya keluar dari sistem POS)
      </p>
    </div>

    <div class="footer">
      Email ini dikirim secara otomatis untuk menjaga keamanan operasional kasir SipSpot.<br>
      © ${new Date().getFullYear()} SipSpot Beverage & Snack. Semua hak dilindungi.
    </div>
  </div>
</body>
</html>
  `;

  try {
    if (!transporter) {
      console.warn('[SMTP] Transporter not ready, skipping login alert email to:', recipientEmail);
      return { success: false, error: 'SMTP transporter not configured' };
    }

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: recipientEmail,
      subject,
      html
    });

    console.log(`[SMTP] Login alert email sent to ${recipientEmail}, MessageId: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.warn(`[SMTP] Failed to send login alert to ${recipientEmail}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send full login history report to email
 */
export async function sendLoginHistoryReportEmail(params: {
  recipientEmail: string;
  userName: string;
  history: any[];
  appUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { recipientEmail, userName, history, appUrl } = params;

  const rowsHtml = history
    .slice(0, 20)
    .map((item, idx) => {
      const timeStr = new Date(item.timestamp).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta'
      });
      const isRevoked = item.status === 'REVOKED';
      const isActive = item.status === 'ACTIVE';

      let statusBadge = `<span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700; background-color:#e0f2fe; color:#0369a1;">Selesai</span>`;
      if (isActive) {
        statusBadge = `<span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700; background-color:#dcfce7; color:#15803d;">● Aktif</span>`;
      } else if (isRevoked) {
        statusBadge = `<span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700; background-color:#fee2e2; color:#b91c1c;">Dicabut</span>`;
      }

      const revokeUrl = `${appUrl.replace(/\/$/, '')}/api/auth/revoke-session?token=${encodeURIComponent(
        item.revokeToken || ''
      )}&session=${encodeURIComponent(item.sessionId || '')}`;

      const actionBtn =
        isActive && item.revokeToken
          ? `<a href="${revokeUrl}" target="_blank" style="color:#dc2626; font-size:11px; font-weight:bold; text-decoration:underline;">Logout</a>`
          : `<span style="color:#9ca3af; font-size:11px;">-</span>`;

      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fdfaf9'}; border-bottom: 1px solid #f5e4e1;">
        <td style="padding: 9px 8px; font-size: 12px; color: #221a18;"><strong>${timeStr}</strong></td>
        <td style="padding: 9px 8px; font-size: 11px; color: #59413c;">${item.device || item.userAgent || 'Unknown'}</td>
        <td style="padding: 9px 8px; font-size: 11px; color: #59413c;"><code>${item.ipAddress || '-'}</code></td>
        <td style="padding: 9px 8px; font-size: 11px; color: #59413c;">${item.loginMethod}</td>
        <td style="padding: 9px 8px; text-align: center;">${statusBadge}</td>
        <td style="padding: 9px 8px; text-align: center;">${actionBtn}</td>
      </tr>
    `;
    })
    .join('');

  const subject = `[Keamanan SipSpot] Laporan Riwayat Login Akun ${userName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff8f6; color: #221a18; padding: 24px 12px; margin: 0; }
    .card { background-color: #ffffff; max-width: 620px; margin: 0 auto; border-radius: 20px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #f2dfdc; }
    .header { text-align: center; border-bottom: 2px solid #fbf0ee; padding-bottom: 20px; margin-bottom: 20px; }
    .title { color: #221a18; font-size: 20px; font-weight: bold; margin: 0 0 6px 0; }
    .subtitle { color: #785a53; font-size: 13px; margin: 0; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .table th { text-align: left; padding: 9px 8px; border-bottom: 2px solid #f0dfdb; color: #59413c; font-size: 12px; background: #fdfaf9; }
    .footer { text-align: center; font-size: 11px; color: #a18680; margin-top: 24px; border-top: 1px solid #fbf0ee; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="font-size: 28px; margin-bottom: 6px;">🛡️</div>
      <h2 class="title">Laporan Riwayat Login Akun</h2>
      <p class="subtitle">Rekapitulasi aktivitas akses akun SipSpot POS untuk ${userName}</p>
    </div>

    <p style="font-size: 13px; line-height: 1.5; color: #433431;">
      Berikut adalah daftar 20 aktivitas login terakhir pada akun <strong>${recipientEmail}</strong>. Jika Anda melihat sesi aktif yang mencurigakan, klik tombol <strong>Logout</strong> pada baris terkait untuk mengeluarkannya secara instan.
    </p>

    <div style="overflow-x: auto;">
      <table class="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Perangkat</th>
            <th>IP</th>
            <th>Metode</th>
            <th style="text-align:center;">Status</th>
            <th style="text-align:center;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Belum ada riwayat login</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="footer">
      © ${new Date().getFullYear()} SipSpot Beverage & Snack POS Security System.<br>
      Dilindungi dengan otentikasi multi-perangkat dan deteksi intrusi.
    </div>
  </div>
</body>
</html>
  `;

  try {
    if (!transporter) {
      return { success: false, error: 'SMTP transporter not configured' };
    }

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: recipientEmail,
      subject,
      html
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

