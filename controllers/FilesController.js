import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';
// import DBClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = require('mongodb');
const mime = require('mime-types');

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
    console.log(dbClient);
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

  static async putPublish(req, res) {
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

    await dbClient.client.db().collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: true } },
    );

    return res.json({ ...file, isPublic: true });
  }

  static async putUnpublish(request, response) {
    const token = request.header('X-Token') || null;
    if (!token) return response.status(401).send({ error: 'Unauthorized' });

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return response.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
    if (!user) return response.status(401).send({ error: 'Unauthorized' });

    const idFile = request.params.id || '';

    let fileDocument = await dbClient.db.collection('files').findOne({ _id: ObjectId(idFile), userId: user._id });
    if (!fileDocument) return response.status(404).send({ error: 'Not found' });

    await dbClient.db.collection('files').update({ _id: ObjectId(idFile) }, { $set: { isPublic: true } });
    fileDocument = await dbClient.db.collection('files').findOne({ _id: ObjectId(idFile), userId: user._id });

    return response.send({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
    });
  }

  static async getFile(request, response) {
    const idFile = request.params.id || '';
    const size = request.query.size || 0;

    const fileDocument = await dbClient.db.collection('files').findOne({ _id: ObjectId(idFile) });
    if (!fileDocument) return response.status(404).send({ error: 'Not found' });

    const { isPublic } = fileDocument;
    const { userId } = fileDocument;
    const { type } = fileDocument;

    let user = null;
    let owner = false;

    const token = request.header('X-Token') || null;
    if (token) {
      const redisToken = await redisClient.get(`auth_${token}`);
      if (redisToken) {
        user = await dbClient.db.collection('users').findOne({ _id: ObjectId(redisToken) });
        if (user) owner = user._id.toString() === userId.toString();
      }
    }

    if (!isPublic && !owner) return response.status(404).send({ error: 'Not found' });
    if (['folder'].includes(type)) return response.status(400).send({ error: 'A folder doesn\'t have content' });

    const realPath = size === 0 ? fileDocument.localPath : `${fileDocument.localPath}_${size}`;

    try {
      const dataFile = fs.readFileSync(realPath);
      const mimeType = mime.contentType(fileDocument.name);
      response.setHeader('Content-Type', mimeType);
      return response.send(dataFile);
    } catch (error) {
      return response.status(404).send({ error: 'Not found' });
    }
  }
}

export default FilesController;
