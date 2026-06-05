/**
 * Human-friendly random codes for joining groups and recovering identity.
 *
 * The alphabet deliberately omits characters that are easy to confuse when
 * read aloud or typed by someone in a hurry (0/O, 1/I/L), so a grandparent can
 * read a group code off a phone screen without trouble.
 */

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1

const ALPHABET_LEN = CODE_ALPHABET.length;
// Largest multiple of ALPHABET_LEN that fits in a byte — used to reject biased
// samples so every character is equally likely.
const UNBIASED_MAX = 256 - (256 % ALPHABET_LEN);

/** Generate a random code of `length` characters from CODE_ALPHABET. */
export function randomCode(length: number): string {
  if (length <= 0) throw new RangeError("length must be positive");
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length - out.length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < UNBIASED_MAX) out += CODE_ALPHABET[b % ALPHABET_LEN];
    }
  }
  return out;
}

/** A short code used to join a group, e.g. "FAM7X2". */
export function generateGroupCode(): string {
  return randomCode(6);
}

/**
 * A longer code a user writes down to reclaim their identity on a new device,
 * grouped for readability, e.g. "K7Q2-9MTX-3RBP".
 */
export function generateRecoveryCode(): string {
  const raw = randomCode(12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Normalize user-entered codes (uppercase, strip spaces/dashes). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}
