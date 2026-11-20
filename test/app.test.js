const request = require('supertest');
const app = require('../server');

describe('QuickNote API', () => {
  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
  it('POST /notes should save a note', async () => {
    const res = await request(app).post('/notes').send({ text: 'Test Note' });
    expect(res.statusCode).toBe(201);
  });
});