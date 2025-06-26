import request from 'supertest';
import app from '../../server'; // Make sure you export your Express app

describe('GET /status', () => {
  it('should return { redis: true, db: true }', async () => {
    const res = await request(app).get('/status');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.keys(['redis', 'db']);
  });
});
