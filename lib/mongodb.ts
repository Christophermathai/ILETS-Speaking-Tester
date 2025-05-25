import { MongoClient, MongoClientOptions } from "mongodb";

const uri = "mongodb://admin:123@localhost:27017/?authSource=admin";
const options: MongoClientOptions = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
const clientPromise = global._mongoClientPromise!;

export default clientPromise;