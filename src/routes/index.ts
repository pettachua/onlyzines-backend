import { Router } from 'express';
import authRoutes from './auth';
import publisherRoutes from './publisher';
import publicRoutes from './public';

const router = Router();

router.use('/auth', authRoutes);
router.use('/publisher', publisherRoutes);
router.use('/public', publicRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
