import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  assertProfileCryptoConfigured,
  cpfLookup,
  decryptCpf,
  encryptCpf,
  ProfileCryptoConfigurationError,
} from "../lib/profile/crypto";

const original = { ...process.env };
const key = () => randomBytes(32).toString("base64");

test.afterEach(() => {
  process.env = { ...original };
});

function configure() {
  process.env.PROFILE_CPF_ACTIVE_KEY_VERSION = "v1";
  process.env.PROFILE_CPF_ENCRYPTION_KEY_V1 = key();
  process.env.PROFILE_CPF_LOOKUP_KEY = key();
}

test("AES-256-GCM usa IV aleatório e recupera o CPF", () => {
  configure();
  const first = encryptCpf("52998224725");
  const second = encryptCpf("52998224725");
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(decryptCpf(first), "52998224725");
});

test("HMAC é determinístico sem expor o CPF", () => {
  configure();
  const first = cpfLookup("52998224725");
  assert.equal(first, cpfLookup("52998224725"));
  assert.notEqual(first, cpfLookup("12345678909"));
  assert.equal(first.includes("52998224725"), false);
});

test("chave incorreta falha na autenticação GCM", () => {
  configure();
  const encrypted = encryptCpf("52998224725");
  process.env.PROFILE_CPF_ENCRYPTION_KEY_V1 = key();
  assert.throws(() => decryptCpf(encrypted));
});

test("rotação lê V1 e grava V2 mantendo as duas chaves", () => {
  configure();
  const oldValue = encryptCpf("52998224725");
  process.env.PROFILE_CPF_ENCRYPTION_KEY_V2 = key();
  process.env.PROFILE_CPF_ACTIVE_KEY_VERSION = "v2";
  const rotated = encryptCpf(decryptCpf(oldValue));
  assert.equal(rotated.keyVersion, "v2");
  assert.equal(decryptCpf(rotated), "52998224725");
});

test("configuração ausente falha fechada", () => {
  delete process.env.PROFILE_CPF_ACTIVE_KEY_VERSION;
  delete process.env.PROFILE_CPF_LOOKUP_KEY;
  assert.throws(
    () => assertProfileCryptoConfigured(),
    ProfileCryptoConfigurationError,
  );
});
