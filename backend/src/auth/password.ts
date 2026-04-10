import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';

type ScryptParams = {
  cost: number;
  blockSize: number;
  parallelization: number;
  keyLength: number;
};

export type PasswordHashProfile = 'standard' | 'low';
type PasswordHashProfileId = 'standard-v1' | 'low-v1';
type PasswordHashProfileDefinition = {
  id: PasswordHashProfileId;
  params: ScryptParams;
};

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: { cost: number; blockSize: number; parallelization: number; maxmem: number }
) => Promise<Buffer>;
const saltSize = 16;
const hashPrefix = 'scrypt';
const minWorkerBatchSize = 64;
const maxHashWorkers = Math.min(Math.max(availableParallelism(), 1), 16);
const passwordHashProfiles: Record<PasswordHashProfile, PasswordHashProfileDefinition> = {
  standard: {
    id: 'standard-v1',
    params: {
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
      keyLength: 64
    }
  },
  low: {
    id: 'low-v1',
    params: {
      cost: 4_096,
      blockSize: 8,
      parallelization: 1,
      keyLength: 64
    }
  }
};
const passwordHashProfilesById = Object.fromEntries(
  Object.values(passwordHashProfiles).map((profile) => [profile.id, profile])
) as Record<PasswordHashProfileId, PasswordHashProfileDefinition>;
const passwordHashWorkerScript = `
const { randomBytes, scryptSync } = require('node:crypto');
const { parentPort, workerData } = require('node:worker_threads');

const saltSize = ${saltSize};
const hashPrefix = ${JSON.stringify(hashPrefix)};
function formatHash(salt, derivedKey, profileId) {
  return \`\${hashPrefix}\\$\${profileId}\\$\${salt.toString('hex')}\\$\${derivedKey.toString('hex')}\`;
}

const hashes = workerData.passwords.map((password) => {
  const params = workerData.params;
  const salt = randomBytes(saltSize);
  const derivedKey = scryptSync(password, salt, params.keyLength, params);
  return formatHash(salt, derivedKey, workerData.profileId);
});

parentPort.postMessage(hashes);
`;

function toScryptOptions(params: ScryptParams) {
  return {
    ...params,
    maxmem: Math.max(32 * 1024 * 1024, 128 * params.cost * params.blockSize)
  };
}

function isHex(value: string) {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-f]+$/i.test(value);
}

function formatHash(salt: Buffer, derivedKey: Buffer, profileId: PasswordHashProfileId) {
  return `${hashPrefix}$${profileId}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

function parseHash(value: string) {
  const parts = value.split('$');
  const [prefix, profileId, saltHex, hashHex] = parts;

  if (parts.length !== 4 || prefix !== hashPrefix || !profileId || !saltHex || !hashHex) {
    return null;
  }

  try {
    const profile = passwordHashProfilesById[profileId as PasswordHashProfileId];

    if (!profile || !isHex(saltHex) || !isHex(hashHex)) {
      return null;
    }

    return {
      profileId: profile.id,
      params: profile.params,
      salt: Buffer.from(saltHex, 'hex'),
      hash: Buffer.from(hashHex, 'hex')
    };
  } catch {
    return null;
  }
}

function resolvePasswordHashProfile(profile: PasswordHashProfile) {
  return passwordHashProfiles[profile];
}

export async function hashPassword(password: string, profile: PasswordHashProfile = 'standard') {
  const resolvedProfile = resolvePasswordHashProfile(profile);
  const salt = randomBytes(saltSize);
  const derivedKey = await scryptAsync(
    password,
    salt,
    resolvedProfile.params.keyLength,
    toScryptOptions(resolvedProfile.params)
  );
  return formatHash(salt, derivedKey, resolvedProfile.id);
}

export function hashPasswordSync(password: string, profile: PasswordHashProfile = 'standard') {
  const resolvedProfile = resolvePasswordHashProfile(profile);
  const salt = randomBytes(saltSize);
  const derivedKey = scryptSync(
    password,
    salt,
    resolvedProfile.params.keyLength,
    toScryptOptions(resolvedProfile.params)
  );
  return formatHash(salt, derivedKey, resolvedProfile.id);
}

function hashPasswordsInWorker(passwords: string[], profileId: PasswordHashProfileId, params: ScryptParams) {
  return new Promise<string[]>((resolve, reject) => {
    const worker = new Worker(passwordHashWorkerScript, {
      eval: true,
      workerData: { passwords, profileId, params }
    });
    let settled = false;

    worker.once('message', (hashes: string[]) => {
      settled = true;
      resolve(hashes);
    });
    worker.once('error', (error) => {
      settled = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (!settled && code !== 0) {
        reject(new Error(`密码哈希工作线程异常退出，退出码：${code}`));
      }
    });
  });
}

export async function hashPasswords(passwords: string[], profile: PasswordHashProfile = 'standard') {
  if (passwords.length === 0) {
    return [];
  }

  const resolvedProfile = resolvePasswordHashProfile(profile);
  const workerCount = Math.min(maxHashWorkers, passwords.length);

  if (workerCount <= 1 || passwords.length < minWorkerBatchSize) {
    return Promise.all(passwords.map((password) => hashPassword(password, profile)));
  }

  const chunkSize = Math.ceil(passwords.length / workerCount);
  const chunks: string[][] = [];

  for (let index = 0; index < passwords.length; index += chunkSize) {
    chunks.push(passwords.slice(index, index + chunkSize));
  }

  const hashedChunks = await Promise.all(
    chunks.map((chunk) => hashPasswordsInWorker(chunk, resolvedProfile.id, resolvedProfile.params))
  );
  return hashedChunks.flat();
}

export async function verifyPassword(password: string, hashedPassword: string) {
  const parsed = parseHash(hashedPassword);

  if (!parsed) {
    return false;
  }

  const derivedKey = await scryptAsync(password, parsed.salt, parsed.hash.length, toScryptOptions(parsed.params));
  return derivedKey.length === parsed.hash.length && timingSafeEqual(derivedKey, parsed.hash);
}

export function isLowCostPasswordHash(hashedPassword: string) {
  const parsed = parseHash(hashedPassword);
  return parsed?.profileId === passwordHashProfiles.low.id;
}
