import type { NextFunction, Request, Response } from 'express';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { config } from '../config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The authenticated Supabase user (set by requireAuth). */
      user?: User;
      /** A Supabase client acting AS that user, so Row Level Security applies. */
      db?: SupabaseClient;
    }
  }
}

/**
 * Verifies the Supabase access token sent by the browser
 * (Authorization: Bearer <jwt>) and attaches a per-request, user-scoped client.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const db = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Asks Supabase Auth to validate the token (checks signature, expiry, revocation).
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = data.user;
  req.db = db;
  next();
}
