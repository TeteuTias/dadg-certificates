import { GridFSBucket, Db } from 'mongodb';
import { Readable } from 'stream';

let gridFSBucket: GridFSBucket | null = null;

/**
 * Inicializa o GridFSBucket para a coleção article.projects
 * @param db - Instância do banco de dados MongoDB
 * @returns GridFSBucket configurado
 */
export function initializeGridFS(db: Db): GridFSBucket {
  if (!gridFSBucket) {
    gridFSBucket = new GridFSBucket(db, { bucketName: 'article.projects' });
  }
  return gridFSBucket;
}

/**
 * Obtém a instância do GridFSBucket
 * @returns GridFSBucket ou null se não inicializado
 */
export function getGridFSBucket(): GridFSBucket | null {
  return gridFSBucket;
}

/**
 * Faz upload de um arquivo para GridFS
 * @param bucket - GridFSBucket
 * @param fileBuffer - Buffer do arquivo
 * @param fileName - Nome do arquivo
 * @param metadata - Metadados adicionais
 * @returns Promise com o ID do arquivo
 */
export async function uploadFileToGridFS(
  bucket: GridFSBucket,
  fileBuffer: Buffer,
  fileName: string,
  metadata?: Record<string, any>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: metadata || {},
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id.toString());
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });

    const readableStream = Readable.from(fileBuffer);
    readableStream.pipe(uploadStream);
  });
}

/**
 * Faz download de um arquivo do GridFS
 * @param bucket - GridFSBucket
 * @param fileId - ID do arquivo no GridFS
 * @returns Promise com o Buffer do arquivo
 */
export async function downloadFileFromGridFS(
  bucket: GridFSBucket,
  fileId: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    downloadStream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Deleta um arquivo do GridFS
 * @param bucket - GridFSBucket
 * @param fileId - ID do arquivo no GridFS
 * @returns Promise<void>
 */
export async function deleteFileFromGridFS(
  bucket: GridFSBucket,
  fileId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    bucket.delete(fileId, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Obtém informações sobre um arquivo no GridFS
 * @param bucket - GridFSBucket
 * @param fileId - ID do arquivo no GridFS
 * @returns Promise com as informações do arquivo
 */
export async function getFileInfoFromGridFS(
  bucket: GridFSBucket,
  fileId: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    bucket.find({ _id: fileId }).toArray((error, files) => {
      if (error) {
        reject(error);
      } else if (files.length === 0) {
        reject(new Error('Arquivo não encontrado'));
      } else {
        resolve(files[0]);
      }
    });
  });
}

