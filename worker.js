import { ObjectId } from 'mongodb';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs/promises';
import path from 'path';
import fileQueue from './utils/queue';
import userQueue from './utils/userQueue';
import dbClient from './utils/db';

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.client
    .db()
    .collection('files')
    .findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

  if (!file) throw new Error('File not found');

  const sizes = [500, 250, 100];
  const originalPath = file.localPath;

  for (const size of sizes) {
    const options = { width: size };
    const thumbnail = await imageThumbnail(originalPath, options);
    const thumbPath = `${originalPath}_${size}`;
    await fs.writeFile(thumbPath, thumbnail);
  }

  // 👇 User queue
  userQueue.process(async (job) => {
    const { userId } = job.data;

    if (!userId) throw new Error('Missing userId');

    const user = await dbClient.client
      .db()
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) throw new Error('User not found');

    console.log(`Welcome ${user.email}!`);
  });
});
