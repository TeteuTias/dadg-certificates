import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export type EncryptedCpf = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

export class ProfileCryptoConfigurationError extends Error {
  constructor(message = "Profile cryptography is not configured") {
    super(message);
    this.name = "ProfileCryptoConfigurationError";
  }
}

function decodeKey(value: string | undefined, variableName: string): Buffer {
  if (!value)
    throw new ProfileCryptoConfigurationError(`${variableName} is missing`);
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw new ProfileCryptoConfigurationError(
      `${variableName} must decode to exactly 32 bytes`,
    );
  }
  return decoded;
}

function encryptionVariable(version: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(version)) {
    throw new ProfileCryptoConfigurationError(
      "Invalid profile encryption key version",
    );
  }
  return `PROFILE_CPF_ENCRYPTION_KEY_${version.toUpperCase()}`;
}

export function getActiveKeyVersion(): string {
  const version = process.env.PROFILE_CPF_ACTIVE_KEY_VERSION?.trim();
  if (!version)
    throw new ProfileCryptoConfigurationError(
      "PROFILE_CPF_ACTIVE_KEY_VERSION is missing",
    );
  encryptionVariable(version);
  return version;
}

export function assertProfileCryptoConfigured(): void {
  const version = getActiveKeyVersion();
  decodeKey(
    process.env[encryptionVariable(version)],
    encryptionVariable(version),
  );
  decodeKey(process.env.PROFILE_CPF_LOOKUP_KEY, "PROFILE_CPF_LOOKUP_KEY");
}

function getEncryptionKey(version: string): Buffer {
  const variable = encryptionVariable(version);
  return decodeKey(process.env[variable], variable);
}

export function encryptCpf(
  cpf: string,
  keyVersion = getActiveKeyVersion(),
): EncryptedCpf {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(keyVersion),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(cpf, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion,
  };
}

export function decryptCpf(value: EncryptedCpf): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(value.keyVersion),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function cpfLookup(cpf: string): string {
  const lookupKey = decodeKey(
    process.env.PROFILE_CPF_LOOKUP_KEY,
    "PROFILE_CPF_LOOKUP_KEY",
  );
  return createHmac("sha256", lookupKey).update(cpf, "utf8").digest("hex");
}
