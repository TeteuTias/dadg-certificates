import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as sign } from "@aws-sdk/s3-request-presigner";
export function r2() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT_URL || process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:
        process.env.R2_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey:
        process.env.R2_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}
export async function getSignedUrl(bucket: string, key: string) {
  try {
    const client = r2();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return sign(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: 60,
    });
  } catch (e) {
    if (e instanceof Error && ["NotFound", "NoSuchKey"].includes(e.name))
      return undefined;
    throw e;
  }
}
