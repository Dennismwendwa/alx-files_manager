import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const existingUser = await dbClient.client.db().collection('users').findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);

    const newUser = {
      email,
      password: hashedPassword,
      id: uuidv4()
    };

    await dbClient.client.db().collection('users').insertOne(newUser);

    return res.status(201).json({ id: newUser.id, email: newUser.email });
  }

  static async getMe(req, res) {
    const { 'x-token': token } = req.headers;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.client.db().collection('users').findOne({ _id: ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResponse = {
      id: user._id,
      email: user.email
    };

    return res.status(200).json(userResponse);
  }
}

export default UsersController;
