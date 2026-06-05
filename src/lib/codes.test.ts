import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_ALPHABET,
  randomCode,
  generateGroupCode,
  generateRecoveryCode,
  normalizeCode,
} from "./codes.ts";

test("CODE_ALPHABET omits ambiguous characters", () => {
  for (const ch of ["0", "O", "1", "I", "L"]) {
    assert.ok(!CODE_ALPHABET.includes(ch), `${ch} should be excluded`);
  }
});

test("randomCode honours length and alphabet", () => {
  const allowed = new RegExp(`^[${CODE_ALPHABET}]+$`);
  for (let len = 1; len <= 16; len++) {
    const c = randomCode(len);
    assert.equal(c.length, len);
    assert.ok(allowed.test(c), `"${c}" has out-of-alphabet chars`);
  }
  assert.throws(() => randomCode(0), RangeError);
});

test("group codes are 6 chars and effectively unique", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = generateGroupCode();
    assert.equal(code.length, 6);
    seen.add(code);
  }
  // ~31^6 space; 2000 draws should essentially never collide.
  assert.ok(seen.size > 1990, `too many collisions: ${seen.size}/2000`);
});

test("recovery codes are grouped 4-4-4", () => {
  const code = generateRecoveryCode();
  assert.match(code, new RegExp(`^[${CODE_ALPHABET}]{4}-[${CODE_ALPHABET}]{4}-[${CODE_ALPHABET}]{4}$`));
});

test("normalizeCode uppercases and strips spaces/dashes", () => {
  assert.equal(normalizeCode(" fam-7x2 "), "FAM7X2");
  assert.equal(normalizeCode("k7q2-9mtx-3rbp"), "K7Q29MTX3RBP");
});
