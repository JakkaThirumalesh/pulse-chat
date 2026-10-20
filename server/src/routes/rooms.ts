import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const ROOM_COLUMNS = 'id, name, created_at';

// GET /api/rooms
roomsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await req
      .db!.from('rooms')
      .select(ROOM_COLUMNS)
      .order('created_at', { ascending: true });

    if (error) throw new HttpError(500, error.message);
    res.json({ rooms: data });
  }),
);

const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Room name is required')
    .max(40, 'Room name must be 40 characters or fewer')
    .transform((n) => n.toLowerCase().replace(/\s+/g, '-')),
});

// POST /api/rooms  { name }
roomsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = createRoomSchema.parse(req.body);

    const { data, error } = await req
      .db!.from('rooms')
      .insert({ name, created_by: req.user!.id })
      .select(ROOM_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') throw new HttpError(409, 'A room with that name already exists');
      throw new HttpError(500, error.message);
    }
    res.status(201).json({ room: data });
  }),
);
