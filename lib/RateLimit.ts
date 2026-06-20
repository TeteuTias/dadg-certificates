import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { MongoClient } from "mongodb";
// 
interface RateLimitDocument {
    _id: string;
    count: number;
    ip: string;
    createdAt: Date;
}
interface TrafficLog {
    _id: string;
    count: number;
    ip: string;
    path: string;
    createdAt: Date;
}

const MONGODB_URI = process.env.MONGODB_URI
const MONGODB_DB = process.env.MONGODB_DB
if (!MONGODB_URI || MONGODB_URI === "") {
    throw new Error("MONGODB_URI is not defined in environment variables");
}
if (!MONGODB_DB || MONGODB_DB === "") {
    throw new Error("MONGODB_DB is not defined in environment variables");
}
// 1. Variável global para manter a conexão viva entre as invocações Serverless
let cachedClient: MongoClient | null = null;

async function getMongoClient() {
    if (cachedClient) return cachedClient;

    const client = new MongoClient(MONGODB_URI!);
    await client.connect();
    cachedClient = client;
    return client;
}

export async function rateLimit(req: NextRequest, limit: number): Promise<{ canAccess: boolean; count?: number }> {
    let ip = req.headers.get('x-forwarded-for')

    if (!ip) {
        // Escolhi dar throw aqui, porque se não tiver o IP, não tem como aplicar o Rate Limit, e é melhor crachar do que deixar sem proteção
        throw new Error("Unable to determine client IP address for rate limiting");
    }

    if (ip === '::1') ip = '127.0.0.1';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();

    const path = req.nextUrl.pathname;
    const now = new Date();
    const minuteWindow = now.toISOString().substring(0, 16);

    // O hash gerado será uma String, e é perfeito para ser o _id
    const ipHex = createHash('sha256').update(ip).digest('hex');
    const id = `${minuteWindow}-` + createHash('sha256')
        .update(`${ip}:${req.nextUrl.origin}:${path}`)
        .digest('hex');
    try {
        // 2. Chama a conexão via cache
        const client = await getMongoClient();
        const db = client.db("proxy");
        const collection = db.collection<RateLimitDocument>("rateLimit");
        /*
        const result = await collection.findOneAndUpdate(
            { _id: id }, // AQUI NAO É UM OBJECT_ID
            {
                $inc: { count: 1 },
                $setOnInsert: {
                    origin: req.nextUrl.origin,
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
                    ip: ipHex
                }
            },
            {
                upsert: true,
                returnDocument: 'after'
            }
        );
        */
        const result = await collection.findOneAndUpdate(
            { _id: id }, // AQUI NAO É UM OBJECT_ID
            {
                $inc: { count: 1 },
                // NOVO: Adiciona a rota exata na lista "paths" a cada requisição
                $setOnInsert: {
                    origin: req.nextUrl.origin,
                    path: req.nextUrl.pathname,
                    createdAt: new Date(),
                    ip: ipHex
                }
            },
            {
                upsert: true,
                returnDocument: 'after'
            }
        );

        const currentCount = result?.count || 0;

        if (currentCount > limit) {
            // Se não estiver ok, salvamos os Logs
            db.collection<TrafficLog>("trafficLogs").findOneAndUpdate(
                {
                    _id: `${minuteWindow}-` + createHash('sha256')
                        .update(`${ip}:${req.nextUrl.origin}:${path}`)
                        .digest('hex'),
                }, // AQUI NAO É UM OBJECT_ID
                {
                    $inc: { count: 1 },
                    $setOnInsert: {
                        origin: req.nextUrl.origin,
                        path: path,
                        ip: ipHex,
                        createdAt: new Date(),
                    }
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            )

            return { canAccess: false, count: currentCount };
        }

        return { canAccess: true, count: currentCount };

    } catch (error) {
        console.error("Erro no MongoDB Rate Limit:", error);
        // Se deu erro no RateLimit para tudo!
        return { canAccess: false };
    }
}