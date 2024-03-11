import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const { 'x-token': token } = req.headers;

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId, isPublic, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type or invalid type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId) {
      const parentFile = await dbClient.client.db().collection('files').findOne({ _id: parentId });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
    };

    if (type === 'folder') {
      const result = await dbClient.client.db().collection('files').insertOne(fileDocument);
      return res.status(201).json({ ...fileDocument, id: result.insertedId });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_mmanager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log('created file');
    }
    const filePath = path.join(folderPath, `${uuidv4()}`);

    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

    const result = await dbClient.client.db().collection('files').insertOne({
      ...fileDocument,
      localPath: filePath,
    });

    return res.status(201).json({ ...fileDocument, id: result.insertedId });
  }

  static async getShow(req, res) {
    const userToken = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${userToken}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.client.db().collection('files').findOne({
      _id: dbClient.getObjectId(fileId),
      userId,
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file);
  }

  static async getIndex(req, res) {
    const userToken = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${userToken}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = '0', page = 0 } = req.query;

    const pageSize = 20;
    const skip = page * pageSize;

    const files = await dbClient.client.db().collection('files')
      .find({ userId, parentId })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return res.json(files);
  }
}

export default FilesController;
