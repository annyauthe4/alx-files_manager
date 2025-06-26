import { expect } from 'chai';
import redisClient from '../../utils/redis';

describe('Redis Client', () => {
  it('should be alive', () => {
    expect(redisClient.isAlive()).to.equal(true);
  });

  it('should set and get a key', async () => {
    await redisClient.set('test_key', 'value', 10);
    const result = await redisClient.get('test_key');
    expect(result).to.equal('value');
  });

  it('should delete a key', async () => {
    await redisClient.set('delete_key', 'value', 10);
    await redisClient.del('delete_key');
    const result = await redisClient.get('delete_key');
    expect(result).to.be.null;
  });
});
