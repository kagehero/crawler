import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (db) return db;
  // mongodb+srv://（Atlas）・mongodb://（ローカル）の両方に対応
  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15_000,
  });
  await client.connect();
  const name = process.env.MONGODB_DB_NAME ?? "crawler_jobs";
  db = client.db(name);
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(database: Db) {
  await database.collection("jobs").createIndex({ job_url: 1 }, { unique: true });
  await database.collection("jobs").createIndex({ prefecture: 1, city: 1 });
  await database.collection("jobs").createIndex({ importedAt: -1 });
  await database.collection("scrape_runs").createIndex({ finishedAt: -1 });
}
