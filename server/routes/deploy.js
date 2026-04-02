import { Router } from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';

const router = Router();

// POST /deploy — GitHub webhook endpoint
router.post('/', (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const body = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Only deploy on push to main
  if (req.body.ref !== 'refs/heads/main') {
    return res.json({ message: 'Not main branch, skipping' });
  }

  // Trigger deploy script
  exec('/app/scripts/deploy.sh', (err, stdout, stderr) => {
    if (err) {
      console.error('Deploy error:', stderr);
    } else {
      console.log('Deploy output:', stdout);
    }
  });

  res.json({ message: 'Deploy triggered' });
});

export default router;
