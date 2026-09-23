
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { AADB_EVENTS } from './analytics/events.js';
import { queries } from './analytics/queries.js';

describe('analytics API', () => {
  it('returns a typed overview using demo data when no workspace is configured', async () => {
    const response = await request(createApp()).get('/api/analytics/overview?range=30d');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('demo');
    expect(response.body.metrics).toHaveLength(4);
    expect(response.body.features.length).toBeGreaterThan(0);
  });

  it('rejects unsupported time ranges', async () => {
    const response = await request(createApp()).get('/api/analytics/overview?range=365d');
    expect(response.status).toBe(400);
  });

  it('returns decision intelligence without exposing raw telemetry', async () => {
    const response = await request(createApp()).get('/api/analytics/insights?range=7d');
    expect(response.status).toBe(200);
    expect(response.body.funnel).toHaveLength(5);
    expect(response.body.validationHandoff).toEqual({ shown: 0, started: 0, dismissed: 0, startRate: 0 });
    expect(response.body.guidedJourney).toMatchObject({ interactions: 899, users: 179, sessions: 249 });
    expect(response.body.guidedJourney.choices[0]).toMatchObject({ step: 'create', path: 'brief-image', events: 160 });
    expect(response.body.models[0]).toMatchObject({ validationCalls: 156, validationScore: 86, critiqueWins: 42 });
    expect(response.body.cities[0]).toMatchObject({ city: 'Boydton', country: 'United States', users: 169 });
    expect(response.body.recommendations[0].evidence).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('queryWorkspace');
  });

  it('reports unavailable feedback when Cosmos is not configured', async () => {
    const response = await request(createApp()).get('/api/feedback');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('unavailable');
  });

  it('separates measured, self-reported, registered, and verified impact populations', async () => {
    const response = await request(createApp()).get('/api/analytics/impact?range=30d');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('demo');
    expect(response.body.measured).toHaveLength(4);
    expect(response.body.profiles).toEqual([]);
    expect(response.body.durable).toMatchObject({ source: 'unavailable', stories: 0, registrations: 0, verifiedOutcomes: 0 });
    expect(JSON.stringify(response.body)).not.toMatch(/email|narrative|organizationName/i);
  });

  it('keeps journey telemetry in the product event catalog', () => {
    expect(AADB_EVENTS).toContain('Validation_Handoff');
    expect(AADB_EVENTS).toContain('Guided_Journey');
  });

  it('aggregates guided journey and model quality without exposing raw content', () => {
    expect(queries.guidedJourney).toContain('Properties.path');
    expect(queries.guidedJourney).toContain('dcount(SessionId)');
    expect(queries.modelEfficiency).toContain('Measurements.overallScore');
    expect(queries.modelEfficiency).toContain('Properties.winnerModel');
    expect(queries.guidedJourney).not.toMatch(/prompt|comment|diagramName/i);
    expect(queries.releaseImpact).toContain('project Version, Users, Events, ExportsPerSession, ValidationAdoption');
    expect(queries.impactSummary).toContain('Adoption_Profile_Saved');
    expect(queries.impactSummary).not.toMatch(/email|narrative|organizationName|tenantId|subscriptionId/i);
  });
});