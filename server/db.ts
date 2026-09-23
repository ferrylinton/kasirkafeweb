import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { logDatabase } from './dailyRollingLogger';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'beverage_app_db';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;

// In-memory fallback database to guarantee 100% uptime and resilience
// if external Atlas MongoDB connection experiences network throttling
export const fallbackStore: {
  vendors: any[];
  users: any[];
  categories: any[];
  products: any[];
  orders: any[];
  email_templates: any[];
  email_logs: any[];
  discount_rules: any[];
  inventory_logs: any[];
  login_history: any[];
  revoked_sessions: string[];
  daily_counters: Record<string, number>;
  activity_logs: any[];
  housekeeping_history: any[];
  housekeeping_settings: any;
  vendor_confirmations: any[];
  password_reset_tokens: any[];
  password_reset_requests: any[];
  saved_orders: any[];
} = {
  vendors: [],
  users: [],
  categories: [],
  products: [],
  orders: [],
  saved_orders: [],
  email_templates: [],
  email_logs: [],
  discount_rules: [],
  inventory_logs: [],
  login_history: [],
  revoked_sessions: [],
  daily_counters: {},
  activity_logs: [],
  housekeeping_history: [],
  housekeeping_settings: null,
  vendor_confirmations: [],
  password_reset_tokens: [],
  password_reset_requests: []
};

export async function connectDB(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  if (!MONGODB_URI) {
    console.log('[MongoDB] No MONGODB_URI provided; operating seamlessly with in-memory persistence layer.');
    isConnected = false;
    logDatabase({
      event: 'FALLBACK_MODE',
      message: 'Tidak ada MONGODB_URI; sistem beroperasi dengan layer persistensi in-memory cache.',
      dbName: DB_NAME
    }).catch(() => {});
    return null;
  }

  try {
    console.log('[MongoDB] Connecting to MongoDB...');
    logDatabase({
      event: 'CONNECTING',
      message: `Mencoba menghubungkan ke MongoDB Atlas (${DB_NAME})...`,
      dbName: DB_NAME
    }).catch(() => {});

    client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 3000,
      serverSelectionTimeoutMS: 3000,
    });

    await client.connect();
    dbInstance = client.db(DB_NAME);
    isConnected = true;
    console.log('[MongoDB] Connected successfully to database:', DB_NAME);
    logDatabase({
      event: 'CONNECTED',
      message: `Koneksi berhasil terhubung ke basis data MongoDB: ${DB_NAME}`,
      dbName: DB_NAME
    }).catch(() => {});
    return dbInstance;
  } catch (err: any) {
    console.warn('[MongoDB] Direct connection warning:', err.message);
    console.log('[MongoDB] Operating with local cached persistence layer for maximum resilience.');
    isConnected = false;
    logDatabase({
      event: 'ERROR',
      message: `Peringatan koneksi MongoDB: ${err.message}. Sistem otomatis beralih ke layer persistensi in-memory lokal.`,
      error: err,
      dbName: DB_NAME
    }).catch(() => {});
    return null;
  }
}

export function getDB(): Db | null {
  return dbInstance;
}

export function isDbConnected(): boolean {
  return isConnected;
}
