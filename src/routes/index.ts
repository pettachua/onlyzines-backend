// src/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth';
import publisherRoutes from './publisher';

const router = Router();

router.use('/auth', authRoutes);
router.use('/publisher', publisherRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
