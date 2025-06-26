import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';
import fileQueue from '../utils/queue';

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
      if (type === 'image') {
        await fileQueue.add({
          userId,
          fileId: result.insertedId.toString(),
        });
      }

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

  
  static async putPublish(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    redisClient.get(`auth_${token}`, async (err, userId) => {
      if (err || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      let file;

      try {
        file = await dbClient.client
          .db()
          .collection('files')
          .findOne({
           _id: new ObjectId(fileId),
           userId: new ObjectId(userId)
          });

        if (!file) {
          return res.status(404).json({ error: 'Not found' });
        }

        await dbClient.client
          .db()
          .collection('files')
          .updateOne({
            _id: new ObjectId(fileId) },
            { $set: { isPublic: true } }
          );

        file.isPublic = true;

        return res.status(200).json({
          id: file._id,
          userId: file.userId,
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId,
        });
      } catch (e) {
        return res.status(404).json({ error: 'Not found' });
      }
    });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    redisClient.get(`auth_${token}`, async (err, userId) => {
      if (err || !userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;
      let file;

      try {
        file = await dbClient.client
          .db()
          .collection('files')
          .findOne({
            _id: new ObjectId(fileId),
            userId: new ObjectId(userId)
          });

        if (!file) {
          return res.status(404).json({ error: 'Not found' });
        }

        await dbClient.client
          .db()
          .collection('files')
          .updateOne(
            { _id: new ObjectId(fileId) },
            { $set: { isPublic: false } }
          );

        file.isPublic = false;

        return res.status(200).json({
          id: file._id,
          userId: file.userId,
          name: file.name,
          type: file.type,
          isPublic: file.isPublic,
          parentId: file.parentId,
        });
      } catch (e) {
        return res.status(404).json({ error: 'Not found' });
      }
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token');

    try {
      const file = await dbClient.client
        .db()
        .collection('files')
        .findOne({ _id: new ObjectId(fileId) });

      // File not found
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check permission if not public
      if (!file.isPublic) {
        const userId = token ? await redisClient.get(`auth_${token}`) : null;
        if (!userId || userId.toString() !== file.userId.toString()) {
          return res.status(404).json({ error: 'Not found' });
        }
      }

      // Folder cannot have content
      if (file.type === 'folder') {
        return res.status(400).json(
          { error: "A folder doesn't have content" }
        );
    }

      // Check if file exists on disk
      if (!file.localPath || !fs.existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      const size = req.query.size;
      let filePath = file.localPath;

      if (size && ['500', '250', '100'].includes(size)) {
        filePath = `${file.localPath}_${size}`;
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }
      // Determine MIME type
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);

      // Stream or read file
      const fileContent = fs.createReadStream(file.localPath);
      return fileContent.pipe(res);

    } catch (e) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
