import assert from "node:assert/strict";
import test from "node:test";
import {
  AttendanceTokenConfigurationError,
  isPersonalAttendanceToken,
  signAttendanceToken,
  verifyAttendanceToken,
} from "../lib/events/attendance-token";
import { participantOwnerFilter } from "../lib/events/ownership";

const profileId = "507f1f77bcf86cd799439011";
const otherProfileId = "507f1f77bcf86cd799439012";

function withSecret<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.ATTENDANCE_QR_SECRET;
  if (value === undefined) delete process.env.ATTENDANCE_QR_SECRET;
  else process.env.ATTENDANCE_QR_SECRET = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.ATTENDANCE_QR_SECRET;
    else process.env.ATTENDANCE_QR_SECRET = previous;
  }
}

test("QR pessoal é aceito somente com a assinatura do servidor", () =>
  withSecret("a".repeat(48), () => {
    const token = signAttendanceToken(profileId);
    assert.ok(token);
    assert.equal(isPersonalAttendanceToken(token), true);
    assert.equal(verifyAttendanceToken(token), profileId);

    const [prefix, id, signature] = token.split(".");
    const tampered = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    assert.equal(verifyAttendanceToken(`${prefix}.${id}.${tampered}`), null);
    // A assinatura de um perfil não serve para outro.
    assert.equal(
      verifyAttendanceToken(`${prefix}.${otherProfileId}.${signature}`),
      null,
    );
    assert.equal(verifyAttendanceToken(`${token}.extra`), null);
    assert.equal(verifyAttendanceToken("dadg1.nao-e-id.assinatura"), null);
    assert.notEqual(signAttendanceToken(otherProfileId), token);
  }));

test("trocar o segredo invalida os códigos já emitidos", () => {
  const token = withSecret("a".repeat(48), () => signAttendanceToken(profileId));
  assert.ok(token);
  withSecret("b".repeat(48), () =>
    assert.equal(verifyAttendanceToken(token), null),
  );
});

test("sem segredo válido o QR não é emitido e a leitura falha fechada", () => {
  for (const secret of [undefined, "curto"]) {
    withSecret(secret, () => {
      assert.equal(signAttendanceToken(profileId), null);
      assert.throws(
        () => verifyAttendanceToken(`dadg1.${profileId}.${"A".repeat(22)}`),
        AttendanceTokenConfigurationError,
      );
    });
  }
});

test("código antigo por inscrição não é confundido com o QR pessoal", () => {
  assert.equal(
    isPersonalAttendanceToken("3f2b8c1e-9d4a-4c1b-8f6e-2a7d5b9c0e1f"),
    false,
  );
});

test("titularidade cobre inscrições antigas da conta Auth0", () => {
  const social = participantOwnerFilter({
    _id: "perfil",
    authSubject: "google-oauth2|123",
  });
  assert.deepEqual(social, { profileId: "perfil" });

  const legacy = participantOwnerFilter({
    _id: "perfil",
    authSubject: `auth0|${profileId}`,
  });
  const alternatives = "$or" in legacy ? (legacy.$or ?? []) : [];
  assert.equal(alternatives.length, 2);
  assert.equal(
    String((alternatives[1] as { owner?: unknown }).owner),
    profileId,
  );
});
