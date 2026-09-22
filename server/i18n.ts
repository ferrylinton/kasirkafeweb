import i18next from 'i18next';
import { Request, Response, NextFunction } from 'express';

export const backendResources = {
  id: {
    translation: {
      auth: {
        unauthorized: 'Token otentikasi tidak ditemukan. Silakan login kembali.',
        invalidToken: 'Sesi login telah kedaluwarsa atau tidak valid.',
        sessionRevoked: 'Sesi login Anda telah dikeluarkan dari jauh melalui email keamanan akun.',
        managerOnly: 'Akses ditolak. Fitur ini hanya dapat diakses oleh akun dengan peran Manajer.',
        loginSuccess: 'Login berhasil.',
        invalidCredentials: 'Email atau password yang Anda masukkan salah.',
        userNotFound: 'Pengguna tidak ditemukan dalam sistem.',
        profileUpdated: 'Profil pengguna berhasil diperbarui.',
        wrongCurrentPassword: 'Password saat ini yang Anda masukkan salah.',
        remoteRevokeSuccess: 'Sesi berhasil dicabut dan dikeluarkan dari sistem POS.',
        sessionTimedOut: 'Sesi Anda telah berakhir otomatis karena 15 menit tanpa aktivitas.',
        historySent: 'Riwayat login berhasil dikirim ke alamat email Anda.',
        historySendFailed: 'Gagal mengirim riwayat login ke email.',
        alreadyRevoked: 'Sesi ini sudah tidak aktif atau telah dicabut sebelumnya.',
      },
      products: {
        notFound: 'Produk tidak ditemukan.',
        stockUpdated: 'Stok produk berhasil diperbarui.',
        bulkThresholdSuccess: 'Batas threshold berhasil diterapkan ke semua produk katalog.',
        invalidStock: 'Nilai stok harus berupa angka positif.',
      },
      orders: {
        created: 'Pesanan berhasil disimpan dan diproses.',
        notFound: 'Pesanan tidak ditemukan.',
        receiptSent: 'Struk transaksi berhasil dikirim ke email pelanggan.',
        receiptFailed: 'Gagal mengirim struk transaksi ke email pelanggan.',
        noCustomerEmail: 'Pesanan tidak memiliki data email pelanggan.',
      },
      users: {
        created: 'Pengguna baru berhasil ditambahkan.',
        updated: 'Data pengguna berhasil diperbarui.',
        deleted: 'Pengguna berhasil dihapus dari sistem.',
        emailExists: 'Email tersebut sudah digunakan oleh akun lain.',
        cannotDeleteSelf: 'Anda tidak dapat menghapus akun Anda sendiri.',
      },
      discounts: {
        saved: 'Aturan diskon berhasil disimpan.',
        deleted: 'Aturan diskon berhasil dihapus.',
        notFound: 'Aturan diskon tidak ditemukan.',
        codeExists: 'Kode aturan diskon sudah terdaftar. Gunakan kode unik lain.',
      },
      templates: {
        updated: 'Template email berhasil diperbarui.',
        reset: 'Template email berhasil dikembalikan ke standar bawaan.',
        notFound: 'Template email tidak ditemukan.',
      },
      common: {
        serverError: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
        rateLimited: 'Terlalu banyak permintaan (Rate limit). Silakan coba lagi dalam beberapa detik.',
        validationFailed: 'Validasi data masukan gagal.',
        success: 'Operasi berhasil diselesaikan.',
      }
    }
  },
  en: {
    translation: {
      auth: {
        unauthorized: 'Authentication token not found. Please log in again.',
        invalidToken: 'Login session has expired or is invalid.',
        sessionRevoked: 'Your login session was remotely revoked via account security alert.',
        managerOnly: 'Access denied. This feature is restricted to Manager accounts.',
        loginSuccess: 'Login successful.',
        invalidCredentials: 'The email or password you entered is incorrect.',
        userNotFound: 'User not found in the system.',
        profileUpdated: 'User profile updated successfully.',
        wrongCurrentPassword: 'The current password you entered is incorrect.',
        remoteRevokeSuccess: 'Session was successfully revoked and logged out from POS.',
        sessionTimedOut: 'Your session has timed out due to 15 minutes of inactivity.',
        historySent: 'Login history successfully sent to your email address.',
        historySendFailed: 'Failed to send login history to email.',
        alreadyRevoked: 'This session is already inactive or revoked.',
      },
      products: {
        notFound: 'Product not found.',
        stockUpdated: 'Product stock updated successfully.',
        bulkThresholdSuccess: 'Alert threshold applied to all catalog products.',
        invalidStock: 'Stock value must be a positive integer.',
      },
      orders: {
        created: 'Order successfully saved and processed.',
        notFound: 'Order not found.',
        receiptSent: 'Transaction receipt sent to customer email successfully.',
        receiptFailed: 'Failed to send receipt email to customer.',
        noCustomerEmail: 'Order does not have a customer email address.',
      },
      users: {
        created: 'New user added successfully.',
        updated: 'User data updated successfully.',
        deleted: 'User deleted from the system.',
        emailExists: 'That email is already registered to another account.',
        cannotDeleteSelf: 'You cannot delete your own active account.',
      },
      discounts: {
        saved: 'Discount rule saved successfully.',
        deleted: 'Discount rule deleted successfully.',
        notFound: 'Discount rule not found.',
        codeExists: 'Discount rule code already exists. Please use a unique code.',
      },
      templates: {
        updated: 'Email template updated successfully.',
        reset: 'Email template reset to system default.',
        notFound: 'Email template not found.',
      },
      common: {
        serverError: 'An internal server error occurred. Please try again later.',
        rateLimited: 'Too many requests. Please wait a few moments before retrying.',
        validationFailed: 'Input data validation failed.',
        success: 'Operation completed successfully.',
      }
    }
  }
};

// Initialize backend i18next instance
i18next.init({
  resources: backendResources,
  lng: 'id', // Indonesia as default
  fallbackLng: 'id',
  interpolation: {
    escapeValue: false
  }
});

// Helper for direct translation on the backend
export function tBackend(key: string, lang: 'id' | 'en' = 'id', options?: any): string {
  const result = i18next.t(key, { lng: lang, ...options });
  return typeof result === 'string' ? result : String(result);
}

// Extend Request interface to include language and translation helper
declare global {
  namespace Express {
    interface Request {
      language: 'id' | 'en';
      t: (key: string, options?: any) => string;
    }
  }
}

/**
 * Express Middleware to detect language and attach req.t
 */
export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Check custom header x-language
  const customLang = req.headers['x-language'] as string;
  // 2. Check query parameter lang
  const queryLang = req.query.lang as string;
  // 3. Check Accept-Language header
  const acceptLang = req.headers['accept-language'] as string;

  let resolvedLang: 'id' | 'en' = 'id'; // Default Indonesia

  if (customLang === 'en' || customLang === 'id') {
    resolvedLang = customLang;
  } else if (queryLang === 'en' || queryLang === 'id') {
    resolvedLang = queryLang;
  } else if (acceptLang && acceptLang.startsWith('en')) {
    resolvedLang = 'en';
  }

  req.language = resolvedLang;
  req.t = (key: string, options?: any): string => {
    const result = i18next.t(key, { lng: resolvedLang, ...options });
    return typeof result === 'string' ? result : String(result);
  };

  res.setHeader('Content-Language', resolvedLang);
  next();
}

export default i18next;
