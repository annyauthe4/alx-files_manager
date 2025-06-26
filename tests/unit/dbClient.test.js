import { expect } from 'chai';
import dbClient from '../../utils/db';

describe('MongoDB Client', () => {
  it('should be alive', () => {
    expect(dbClient.isAlive()).to.equal(true);
  });

  it('should return a number for nbUsers', async () => {
    const nbUsers = await dbClient.nbUsers();
    expect(nbUsers).to.be.a('number');
  });

  it('should return a number for nbFiles', async () => {
    const nbFiles = await dbClient.nbFiles();
    expect(nbFiles).to.be.a('number');
  });
});
