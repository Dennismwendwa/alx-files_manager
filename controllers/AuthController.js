import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect (req, res) {
    const authHeader = req.headers.authorization;
    console.log(req.headers);
    console.log(authHeader);
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authData = authHeader.slice('Basic '.length);
    const decodedAuth = Buffer.from(authData, 'base64').toString();
    const [email, password] = decodedAuth.split(':');

    const hashedPassword = sha1(password);
    const user = await dbClient.client.db().collection('users').findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    const userId = user._id.toString();

    await redisClient.set(key, userId, 86400);

    return res.status(200).json({ token });
  }

  static async getDisconnect (req, res) {
    const { 'x-token': token } = req.headers;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(key);
    return res.status(204).send();
  }
}

export default AuthController;
