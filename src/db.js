import { PrismaClient } from '@prisma/client';

// Timestamps are stored as BigInt (epoch ms). Convert to Number on serialize so
// JSON.stringify works and clients receive plain numbers — values fit safely in
// Number until year 287396.
BigInt.prototype.toJSON = function () { return Number(this); };

export const prisma = new PrismaClient();

export function now() { return Date.now(); }

// Coerce BigInt fields on a row (or array of rows) to Number for downstream
// arithmetic. Prisma returns BigInt for `BigInt` columns even when small.
export function toNum(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}
