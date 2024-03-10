import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const {
      DB_HOST = 'localhost',
      DB_PORT = 27017,
      DB_DATABASE = 'files_manager',
    } = process.env;

    const url = `mongodb://${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.connect();
  }

    async connect() {
    try {
      await this.client.connect();
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error(`Error connecting to MongoDB: ${error}`);
      throw error;
    }
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    await this.connectionPromise;
    const usersCollection = this.client.db().collection('users');
    return usersCollection.countDocuments();
  }

  async nbFiles() {
    await this.connectionPromise;
    const filesCollection = this.client.db().collection('files');
    return filesCollection.countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
