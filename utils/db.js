import { MongoClient } from 'mongodb';

// Build MongoDB URI from environment variables or use defaults
const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';
const uri = `mongodb://${host}:${port}/${database}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(uri, { useUnifiedTopology: true });
    this.connected = false;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        this.connected = true;
      })
      .catch((err) => {
        console.error('MongoDB connection error:', err);
        this.connected = false;
      });
  }

  isAlive() {
    return this.connected;
  }

  async nbUsers() {
    if (!this.connected) return 0;
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.connected) return 0;
    return this.db.collection('files').countDocuments();
  }
}

// Export a single instance
const dbClient = new DBClient();
export default dbClient;
