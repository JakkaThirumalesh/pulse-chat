import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

const MESSAGE_COLUMNS = 'id, room_id, user_id, username, content, created_at';

const idSchema = z.string().uuid('Invalid id');

// 15 messages per 10 seconds per user (runs after requireAuth, so req.user is set)
const sendLimiter = rateLimit({
  windowMs: 10_000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: 'You are sending messages too quickly. Slow down a little.' },
});

const listQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/rooms/:roomId/messages?before=<ISO>&limit=50
// Returns the newest `limit` messages (oldest first) plus whether older ones exist.
messagesRouter.get(
  '/rooms/:roomId/messages',
  asyncHandler(async (req, res) => {
    const roomId = idSchema.parse(req.params.roomId);
    const { before, limit } = listQuerySchema.parse(req.query);

    let query = req
      .db!.from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw new HttpError(500, error.message);

    const hasMore = data.length > limit;
    const messages = data.slice(0, limit).reverse();
    res.json({ messages, hasMore });
  }),
);

const sendSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be 2000 characters or fewer'),
});

// POST /api/rooms/:roomId/messages  { content }
messagesRouter.post(
  '/rooms/:roomId/messages',
  sendLimiter,
  asyncHandler(async (req, res) => {
    const roomId = idSchema.parse(req.params.roomId);
    const { content } = sendSchema.parse(req.body);

    const { data, error } = await req
      .db!.from('messages')
      .insert({ room_id: roomId, user_id: req.user!.id, content })
      .select(MESSAGE_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23503') throw new HttpError(404, 'Room not found');
      throw new HttpError(500, error.message);
    }
    res.status(201).json({ message: data });
  }),
);

// DELETE /api/messages/:id  (only your own; RLS enforces this too)
messagesRouter.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);

    const { data, error } = await req
      .db!.from('messages')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select('id');

    if (error) throw new HttpError(500, error.message);
    if (!data || data.length === 0) throw new HttpError(404, 'Message not found');
    res.status(204).end();
  }),
);
