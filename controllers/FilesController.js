import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
// import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    // Validate fields
    if (!name) return res.status(400).json({ error: 'Missing name' });

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if ((type === 'file' || type === 'image') && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;
    if (parentId !== 0) {
      try {
        parentFile = await dbClient.client
          .db()
          .collection('files')
          .findOne({ _id: new ObjectId(parentId) });

        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      } catch (e) {
        return res.status(400).json({ error: 'Parent not found' });
      }
    }

    const fileData = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : new ObjectId(parentId),
    };

    // If folder, just insert the DB entry
    if (type === 'folder') {
      const result = await dbClient.client.db().collection('files').insertOne(fileData);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    // If file or image: save to disk
    try {
      await fs.promises.mkdir(FOLDER_PATH, { recursive: true });

      const filename = uuidv4();
      const localPath = path.join(FOLDER_PATH, filename);

      await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));

      fileData.localPath = localPath;

      const result = await dbClient.client.db().collection('files').insertOne(fileData);

      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    } catch (err) {
      console.error('File save error:', err);
      return res.status(500).json({ error: 'Error saving the file' });
    }
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    let file;

    try {
      file = await dbClient.client
        .db()
        .collection('files')
        .findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
    } catch (e) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;
    const skip = page * limit;

    const matchQuery = {
      userId: new ObjectId(userId),
    };

    if (parentId !== '0') {
      try {
        matchQuery.parentId = new ObjectId(parentId);
      } catch (err) {
        // invalid ObjectId → return empty list
        return res.status(200).json([]);
      }
    } else {
      matchQuery.parentId = 0;
    }

    const files = await dbClient.client
      .db()
      .collection('files')
      .aggregate([
        { $match: matchQuery },
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();

    const result = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.status(200).json(result);
  }
}

export default FilesController;
