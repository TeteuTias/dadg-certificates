import mongoose from 'mongoose';
import { isValidCpf } from '@/lib/profile/validation';
import { ClamError, type Payer } from './domain';
export function payerFrom(body: unknown): Payer {
  if (!body || typeof body !== 'object') throw new ClamError('INVALID_PAYER', 400);
  const input = body as Record<string, unknown>;
  const payer = Object.fromEntries(['name','cpf','zipCode','street','number','neighborhood','complement','phone','email']
    .map(key => [key, typeof input[key] === 'string' ? (input[key] as string).trim() : ''])) as Payer;
  if (Object.entries(payer).some(([key, value]) => (key !== 'complement' && !value) || value.length > 200)) throw new ClamError('INVALID_PAYER', 400);
  payer.cpf = payer.cpf.replace(/\D/g, '');
  payer.zipCode = payer.zipCode.replace(/\D/g, '');
  payer.phone = payer.phone.replace(/\D/g, '');
  payer.email = payer.email.toLowerCase();
  if (payer.cpf.length !== 11 || !isValidCpf(payer.cpf) || !/^\d{8}$/.test(payer.zipCode) ||
      !/^\d{10,13}$/.test(payer.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer.email)) throw new ClamError('INVALID_PAYER', 400);
  return payer;
}

export function parseCheckoutBody(body: unknown, replace: boolean) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ClamError('INVALID_BODY', 400);
  const value = body as Record<string, unknown>;
  if (['usuarioId','userId','owner','items','paymentConfig','totalAmount','unit_price','amountCents','currency'].some(key => key in value)) throw new ClamError('INVALID_BODY', 400);
  if (!Number.isInteger(value.examsCount)) throw new ClamError('INVALID_EXAMS_COUNT', 400);
  if (replace && (typeof value.previousSessionId !== 'string' || !mongoose.isValidObjectId(value.previousSessionId))) throw new ClamError('INVALID_SESSION_ID', 400);
  return { examsCount: value.examsCount as number, payer: payerFrom(value.payer), previousSessionId: replace ? String(value.previousSessionId) : undefined };
}
