import request from 'supertest';
import { expect } from 'chai';
import app from '../../server'; // Make sure Express app is exported here
import dbClient from '../../utils/db';

describe('POST /users', () => {
  before(async () => {
    await dbClient.client.db().collection('users').deleteMany({ email: 'test@example.com' });
  });

  it('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({ password: '123456' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error', 'Missing email');
  });

  it('should return 400 if password is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'test@example.com' });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error', 'Missing password');
  });

  it('should create a new user and return the ID and email', async () => {
    const res = await request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: '123456',
      });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('email', 'test@example.com');
  });

  it('should not allow duplicate registration', async () => {
    const res = await request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: '123456',
      });

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('error', 'Already exist');
  });
});
