import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { logDatabase } from './dailyRollingLogger';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'beverage_app_db';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;

export async function connectDB(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  if (!MONGODB_URI) {
    console.error('[MongoDB] No MONGODB_URI provided. Database connection failed.');
    isConnected = false;
    dbInstance = null;
    logDatabase({
      event: 'ERROR',
      message: 'Tidak ada MONGODB_URI; sistem gagal terhubung ke database.',
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
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });

    client.on('close', () => {
      console.warn('[MongoDB] Connection closed.');
      isConnected = false;
      dbInstance = null;
    });

    client.on('error', (err) => {
      console.error('[MongoDB] Client error:', err);
      isConnected = false;
      dbInstance = null;
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
    console.error('[MongoDB] Direct connection error:', err.message);
    isConnected = false;
    dbInstance = null;
    logDatabase({
      event: 'ERROR',
      message: `Gagal terhubung ke MongoDB: ${err.message}.`,
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
  return isConnected && dbInstance !== null;
}

/**
 * Checks database health via ping command
 */
export async function checkDbConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  if (!dbInstance || !isConnected) {
    // Attempt reconnect
    const db = await connectDB();
    if (!db) {
      return { connected: false, error: 'can not connect to db' };
    }
  }

  try {
    const start = Date.now();
    await dbInstance!.command({ ping: 1 });
    const latencyMs = Date.now() - start;
    isConnected = true;
    return { connected: true, latencyMs };
  } catch (err: any) {
    isConnected = false;
    dbInstance = null;
    return { connected: false, error: err.message || 'can not connect to db' };
  }
}

/**
 * Force reconnect to MongoDB
 */
export async function reconnectDB(): Promise<boolean> {
  isConnected = false;
  if (client) {
    try {
      await client.close();
    } catch (e) {}
    client = null;
    dbInstance = null;
  }
  const db = await connectDB();
  return !!db;
}
