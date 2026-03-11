import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ActionLog } from '../models/ActionLog';

const router = Router();

function authMiddleware(req: Request, res: Response, next: () => void) {
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expected = process.env.API_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, error: 'API_KEY not configured' });
  }
  if (key !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid or missing API key' });
  }
  next();
}

router.use(authMiddleware);

/** POST /api/logs – บอทอื่นส่ง log เข้ามา */
router.post('/logs', async (req: Request, res: Response) => {
  try {
    const { botId, category, action, userId, username, details } = req.body as {
      botId?: string;
      category?: string;
      action?: string;
      userId?: string;
      username?: string;
      details?: Record<string, unknown>;
    };
    if (!botId || !category || !action || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: botId, category, action, userId',
      });
    }
    const doc = await ActionLog.create({
      botId: String(botId).substring(0, 64),
      category: String(category).substring(0, 64),
      action: String(action).substring(0, 128),
      userId: String(userId),
      username: username != null ? String(username).substring(0, 128) : undefined,
      details: details && typeof details === 'object' ? details : undefined,
    });
    res.status(201).json({ success: true, id: doc._id, createdAt: doc.createdAt });
  } catch (e) {
    console.error('[Logger] POST /logs error:', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/** GET /api/logs – สำหรับ Google Apps Script หรือตรวจสอบ (query: botId, category, limit, since) */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.error('[Logger] GET /logs: MongoDB not connected, readyState=', mongoose.connection.readyState);
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }
    const { botId, category, limit = '500', since } = req.query;
    const query: Record<string, unknown> = {};
    if (botId && typeof botId === 'string') query.botId = botId;
    if (category && typeof category === 'string') query.category = category;
    if (since && typeof since === 'string') {
      const date = new Date(since);
      if (!isNaN(date.getTime())) query.createdAt = { $gte: date };
    }
    const n = Math.min(Math.max(parseInt(String(limit), 10) || 500, 1), 5000);
    const logs = await ActionLog.find(query)
      .sort({ createdAt: -1 })
      .limit(n)
      .lean();
    res.json({
      success: true,
      count: logs.length,
      logs: logs.map((l) => ({
        id: l._id,
        botId: l.botId,
        category: l.category,
        action: l.action,
        userId: l.userId,
        username: l.username,
        details: l.details,
        createdAt: l.createdAt,
      })),
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('[Logger] GET /logs error:', err.message, err.stack);
    const message = process.env.NODE_ENV === 'production' ? 'Internal error' : err.message;
    res.status(500).json({ success: false, error: message });
  }
});

/** GET /api/bots – รายการ botId / category ที่มีในระบบ (สำหรับ dropdown ใน Sheet) */
router.get('/bots', async (req: Request, res: Response) => {
  try {
    const bots = await ActionLog.distinct('botId');
    const categories = await ActionLog.distinct('category');
    res.json({ success: true, bots, categories });
  } catch (e) {
    console.error('[Logger] GET /bots error:', e);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
