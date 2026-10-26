import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
/**
 * The shared temporary password members used to be created with. New members
 * get no password (they choose one from their invite link); login refuses this
 * one for anyone who never changed it. Kept only for that check.
 */
export const DEFAULT_PASSWORD = "123456";

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}
