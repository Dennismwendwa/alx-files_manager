import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    
    console.log(dbClient);
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
      id: uuidv4(),
    };

    await dbClient.client.db().collection('users').insertOne(newUser);

    return res.status(201).json({ id: newUser.id, email: newUser.email });
  }
}

export default UsersController;

