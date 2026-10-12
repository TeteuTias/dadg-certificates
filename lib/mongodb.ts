import mongoose, { Mongoose } from "mongoose";
import "./models";
const uri: string | undefined = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Please add your Mongo URI to .env.local");
}

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Estende o objeto global para incluir a propriedade mongoose com o tipo definido
declare global {
  var mongoose: MongooseCache;
}

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}
const cached = global.mongoose;

export async function connectToDatabase(): Promise<Mongoose> {
  if (process.env.DB_ACCESS_DISABLED === "1")
    throw new Error("Database access disabled for offline verification");
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const options = {
      autoIndex: false,
      autoCreate: false,
      ...(process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {}),
      maxPoolSize: process.env.maxPoolSizeValue
        ? parseInt(process.env.maxPoolSizeValue)
        : 10,
      readPreference: "primary" as const, // Força leitura na primária
    };

    // Usa o operador '!' para informar que 'uri' não é undefined
    cached.promise = mongoose
      .connect(uri!, options)
      .then((mongoose) => mongoose);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
