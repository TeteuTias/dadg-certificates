import mongoose, { Mongoose } from 'mongoose';
import "./models"


interface MongooseCache {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

declare global {
    var mongoose: MongooseCache;
}

if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
}
const cached = global.mongoose;

export async function connectToDatabase(): Promise<Mongoose> {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('Please add your Mongo URI to .env.local');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const dbName = process.env.MONGODB_DB;
        if (!dbName) {
            throw new Error('Please add MONGODB_DB to .env.local');
        }
        const options = {
            maxPoolSize: process.env.maxPoolSizeValue
                ? parseInt(process.env.maxPoolSizeValue)
                : 10,
            readPreference: 'primary' as const, // Força leitura na primária
            dbName, // 🔑 Seleciona o banco correto via env
        };

        cached.promise = mongoose.connect(uri, options).then((mongoose) => mongoose);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}
