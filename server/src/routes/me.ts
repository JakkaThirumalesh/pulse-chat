import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';

export const meRouter = Router();

// GET /api/me -> the signed-in user's profile
meRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await req
      .db!.from('profiles')
      .select('id, username')
      .eq('id', req.user!.id)
      .single();

    if (error || !data) throw new HttpError(404, 'Profile not found');
    res.json({ profile: data });
  }),
);
