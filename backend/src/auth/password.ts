const BCRYPT_OPTIONS = {
  algorithm: 'bcrypt',
  cost: 10
} as const;

export function hashPassword(password: string) {
  return Bun.password.hash(password, BCRYPT_OPTIONS);
}

export function hashPasswordSync(password: string) {
  return Bun.password.hashSync(password, BCRYPT_OPTIONS);
}

export function verifyPassword(password: string, hashedPassword: string) {
  return Bun.password.verify(password, hashedPassword);
}
