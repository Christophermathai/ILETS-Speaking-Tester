// lib/mongodb.js
import { MongoClient } from "mongodb";

// Example: With authentication
const uri = "mongodb://admin:123@localhost:27017/?authSource=admin";

const options = {};

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;


export default clientPromise;
