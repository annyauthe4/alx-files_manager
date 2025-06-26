import { mongoClient } from 'mongodb';

const host = process.env.DB_HOST || 'localhost';
const port = process.env.DB_PORT || 27017;
const database = process.env.DB_DATABASE || 'files_manager';

uri = `mongodb://${host}:${port}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(uri, { useUnifiedTopology: true  });
    this.db = null;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
    .catck((err) => {
      console.error('MongoDB connection erro: err');
    });
  }


  IsAlive() {
    return this.db. !== null;
  }
}
