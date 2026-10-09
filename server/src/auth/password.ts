import bcrypt from 'bcryptjs';

const COST = 12;
export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

// A real hash of a random string. Checking against it when the email is unknown makes
// a wrong email take as long as a wrong password, so timing does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('no-such-user-placeholder', COST);

/** True when the password matches; always does the full bcrypt work. */
export function verifyPassword(password: string, hash: string | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && hash !== undefined);
}
