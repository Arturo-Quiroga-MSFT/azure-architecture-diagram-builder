const {
  createImpactStoryRecord,
  createDeploymentRegistrationRecord,
} = require('./impact-records');

module.exports = function registerImpactRoutes(app, getFeedbackContainer) {
  app.post('/api/impact-story', async (req, res) => {
    const container = getFeedbackContainer();
    if (!container) return res.status(503).json({ error: 'Impact storage is not configured' });
    try {
      const item = createImpactStoryRecord(req.body || {});
      await container.items.create(item);
      res.status(201).json({ ok: true, id: item.id, verificationStatus: item.verification.status });
    } catch (err) {
      if (/invalid|required|artifact|email/i.test(err.message)) return res.status(400).json({ error: err.message });
      console.error('[impact-story] error:', err.message);
      res.status(500).json({ error: 'Failed to store impact story' });
    }
  });

  app.post('/api/deployment-registration', async (req, res) => {
    const container = getFeedbackContainer();
    if (!container) return res.status(503).json({ error: 'Impact storage is not configured' });
    try {
      const item = createDeploymentRegistrationRecord(req.body || {});
      await container.items.upsert(item);
      res.status(201).json({ ok: true, id: item.id, verificationStatus: item.verification.status });
    } catch (err) {
      if (/invalid|required|installationId|email/i.test(err.message)) return res.status(400).json({ error: err.message });
      console.error('[deployment-registration] error:', err.message);
      res.status(500).json({ error: 'Failed to store deployment registration' });
    }
  });
};