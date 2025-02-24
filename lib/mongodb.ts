import mongoose, { Mongoose } from 'mongoose';

const uri: string | undefined = process.env.MONGODB_URI;

if (!uri) {
    throw new Error('Please add your Mongo URI to .env.local');
}

interface MongooseCache {
    conn: Mongoose | null;
    promise: Promise<Mongoose> | null;
}

// Estende o objeto global para incluir a propriedade mongoose com o tipo definido
declare global {
    // eslint-disable-next-line no-var
    var mongoose: MongooseCache;
}

if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
}
const cached = global.mongoose;

export async function connectToDatabase(): Promise<Mongoose> {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const options = {
            maxPoolSize: process.env.maxPoolSizeValue
                ? parseInt(process.env.maxPoolSizeValue)
                : 10,
            readPreference: 'primary' as const, // Força leitura na primária
        };

        // Usa o operador '!' para informar que 'uri' não é undefined
        cached.promise = mongoose.connect(uri!, options).then((mongoose) => mongoose);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}