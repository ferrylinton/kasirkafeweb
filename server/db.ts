import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import { logDatabase } from './dailyRollingLogger';

dotenv.config();

function normalizeMongoUri(rawUri?: string): string | null {
  if (!rawUri || typeof rawUri !== 'string') return null;
  let uri = rawUri.trim();
  if (!uri) return null;

  // Auto-correct common typo: missing leading 'm' or letters in 'mongodb'
  if (/^ongodb(\+srv)?:\/\//i.test(uri)) {
    uri = 'm' + uri;
  } else if (/^ngodb(\+srv)?:\/\//i.test(uri)) {
    uri = 'mo' + uri;
  } else if (/^godb(\+srv)?:\/\//i.test(uri)) {
    uri = 'mon' + uri;
  } else if (!/^mongodb(\+srv)?:\/\//i.test(uri) && uri.includes('.mongodb.net')) {
    uri = 'mongodb+srv://' + uri;
  }
  return uri;
}

function resolveMongoConfig(): { uri: string | null; dbName: string } {
  if (!process.env.MONGODB_URI) {
    dotenv.config({ override: true });
  }
  const rawUri = process.env.MONGODB_URI;
  const normalized = normalizeMongoUri(rawUri);
  if (normalized && normalized !== rawUri) {
    process.env.MONGODB_URI = normalized;
  }
  const dbName = (process.env.MONGODB_DB_NAME || '').trim() || 'beverage_app_db';
  return { uri: normalized, dbName };
}

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let isConnected = false;
let connectPromise: Promise<Db | null> | null = null;

export async function connectDB(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const { uri, dbName } = resolveMongoConfig();

    if (!uri) {
      console.error('[MongoDB] No MONGODB_URI provided. Database connection failed.');
      isConnected = false;
      dbInstance = null;
      logDatabase({
        event: 'ERROR',
        message: 'Tidak ada MONGODB_URI; sistem gagal terhubung ke database.',
        dbName
      }).catch(() => {});
      return null;
    }

    try {
      console.log('[MongoDB] Connecting to MongoDB...');
      logDatabase({
        event: 'CONNECTING',
        message: `Mencoba menghubungkan ke MongoDB Atlas (${dbName})...`,
        dbName
      }).catch(() => {});

      if (client) {
        try {
          await client.close();
        } catch {}
        client = null;
      }

      const newClient = new MongoClient(uri, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
      });

      newClient.on('close', () => {
        console.warn('[MongoDB] Connection closed.');
        isConnected = false;
        dbInstance = null;
      });

      newClient.on('error', (err) => {
        console.error('[MongoDB] Client error:', err);
        isConnected = false;
        dbInstance = null;
      });

      await newClient.connect();
      const db = newClient.db(dbName);
      await db.command({ ping: 1 });

      client = newClient;
      dbInstance = db;
      isConnected = true;
      console.log('[MongoDB] Connected successfully to database:', dbName);
      logDatabase({
        event: 'CONNECTED',
        message: `Koneksi berhasil terhubung ke basis data MongoDB: ${dbName}`,
        dbName
      }).catch(() => {});
      return dbInstance;
    } catch (err: any) {
      console.error('[MongoDB] Direct connection error:', err.message);
      isConnected = false;
      dbInstance = null;
      client = null;
      logDatabase({
        event: 'ERROR',
        message: `Gagal terhubung ke MongoDB: ${err.message}.`,
        error: err,
        dbName
      }).catch(() => {});
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export function getDB(): Db | null {
  return dbInstance;
}

export async function ensureDBConnected(): Promise<Db | null> {
  if (dbInstance && isConnected) {
    return dbInstance;
  }
  return connectDB();
}

export function isDbConnected(): boolean {
  return isConnected && dbInstance !== null;
}

/**
 * Checks database health via ping command
 */
export async function checkDbConnection(): Promise<{ connected: boolean; latencyMs?: number; dbName?: string; error?: string }> {
  const { dbName } = resolveMongoConfig();
  if (!dbInstance || !isConnected) {
    const db = await connectDB();
    if (!db) {
      return { connected: false, dbName, error: 'can not connect to db' };
    }
  }

  try {
    const start = Date.now();
    await dbInstance!.command({ ping: 1 });
    const latencyMs = Date.now() - start;
    isConnected = true;
    return { connected: true, latencyMs, dbName: dbInstance!.databaseName };
  } catch (err: any) {
    isConnected = false;
    dbInstance = null;
    return { connected: false, dbName, error: err.message || 'can not connect to db' };
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
    } catch {}
    client = null;
    dbInstance = null;
  }
  const db = await connectDB();
  return !!db;
}
