// =============================================================================
// deploy.js — GitHub Webhook for Auto-Deployment
// =============================================================================
//
// HOW CI/CD WORKS HERE:
// 1. You push code to the "main" branch on GitHub
// 2. GitHub sends a POST request (webhook) to this endpoint
// 3. We verify the request is really from GitHub (using HMAC-SHA256 signature)
// 4. We run the deploy script that pulls the latest code and restarts Docker
//
// WHY VERIFY THE SIGNATURE?
// Anyone could send a POST to /deploy and trigger a deployment.
// GitHub signs the webhook payload with a shared secret (GITHUB_WEBHOOK_SECRET).
// We compute the same signature and compare them. If they don't match,
// the request is rejected — it didn't come from GitHub.
//
// TIMING-SAFE COMPARISON:
// crypto.timingSafeEqual() compares two strings in constant time, regardless
// of how many characters match. A regular === comparison returns "false" as
// soon as it finds a difference, which can leak information about the secret
// through timing analysis. This prevents "timing attacks".
//
// This endpoint does NOT require authentication (no session needed) because
// it's called by GitHub, not by a logged-in user.
// =============================================================================

import { Router } from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';

const router = Router();

router.post('/', (req, res) => {
  // The secret must match what's configured in GitHub webhook settings
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // GitHub sends the signature in this header
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Compute what the signature SHOULD be using our secret
  const body = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  // Timing-safe comparison prevents timing attacks (see comment above)
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Only deploy when pushing to the main branch (ignore feature branches)
  if (req.body.ref !== 'refs/heads/main') {
    return res.json({ message: 'Not main branch, skipping' });
  }

  // Run the deploy script asynchronously (don't wait for it to finish)
  exec('/app/scripts/deploy.sh', (err, stdout, stderr) => {
    if (err) {
      console.error('Deploy error:', stderr);
    } else {
      console.log('Deploy output:', stdout);
    }
  });

  // Respond immediately — deployment runs in the background
  res.json({ message: 'Deploy triggered' });
});

export default router;
