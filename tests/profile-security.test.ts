import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, jwtVerify, SignJWT } from "jose";
import { authorizePrincipal } from "../lib/security/authorization";
import { ADMIN_ROLES_CLAIM, isAdmin } from "../lib/security/isAdmin";
import { adminSessionUser } from "../lib/security/adminSession";
import { API_ROUTE_MAP } from "../lib/security/route-policies";
import { AuthConfigurationError, getStudentAuthConfiguration, studentJwtVerifyOptions } from "../lib/security/verifyToken";
import { isDuplicateKeyError } from "../lib/profile/service";
import {
  isCurrentPrivacyAcceptance,
  PROFILE_PRIVACY_NOTICE_HASH,
  PROFILE_PRIVACY_NOTICE_VERSION,
} from "../lib/profile/privacy-notice";

test("matriz separa aluno e administrador", () => {
  assert.equal(authorizePrincipal("student", "student", false).authorized, true);
  assert.equal(authorizePrincipal("admin", "student", false).status, 403);
  assert.equal(authorizePrincipal("admin", "admin", false).status, 403);
  assert.equal(authorizePrincipal("admin", "admin", true).authorized, true);
  assert.equal(authorizePrincipal("student", null, false).status, 401);
});

test("administrador exige role configurada e claim assinada no ID token", () => {
  const previousRoleName = process.env.DADG_ADMIN_ROLE_NAME;
  const adminUser = {
    sub: "auth0|admin",
    [ADMIN_ROLES_CLAIM]: ["Administrador"],
  };

  try {
    delete process.env.DADG_ADMIN_ROLE_NAME;
    assert.equal(isAdmin(adminUser), false);

    process.env.DADG_ADMIN_ROLE_NAME = "Administrador";
    assert.equal(isAdmin(adminUser), true);
    assert.equal(isAdmin({ sub: "auth0|admin", [ADMIN_ROLES_CLAIM]: ["Administrador "] }), true);
    assert.equal(isAdmin({ sub: "auth0|admin", [ADMIN_ROLES_CLAIM]: [" administrador "] }), false);
    assert.equal(isAdmin({ sub: "auth0|admin", [ADMIN_ROLES_CLAIM]: ["  ", 123] }), false);
    assert.equal(isAdmin({ sub: "auth0|student", [ADMIN_ROLES_CLAIM]: ["student"] }), false);
    assert.equal(isAdmin({ sub: "auth0|admin" }), false);
    assert.equal(isAdmin({ sub: "auth0|admin", [ADMIN_ROLES_CLAIM]: "dadg-admin" }), false);
  } finally {
    if (previousRoleName === undefined) delete process.env.DADG_ADMIN_ROLE_NAME;
    else process.env.DADG_ADMIN_ROLE_NAME = previousRoleName;
  }
});

test("sessão administrativa preserva somente a claim personalizada de roles", () => {
  const user = adminSessionUser({
    sub: "auth0|admin",
    name: "Admin DADG",
    email: "admin@example.test",
    [ADMIN_ROLES_CLAIM]: ["Administrador"],
    "https://example.test/unrelated": "must-not-be-persisted",
  });

  assert.deepEqual(user[ADMIN_ROLES_CLAIM], ["Administrador"]);
  assert.equal(user.sub, "auth0|admin");
  assert.equal(user["https://example.test/unrelated"], undefined);
});

test("aceite é vigente apenas com versão e hash atuais", () => {
  assert.equal(isCurrentPrivacyAcceptance(PROFILE_PRIVACY_NOTICE_VERSION, PROFILE_PRIVACY_NOTICE_HASH), true);
  assert.equal(isCurrentPrivacyAcceptance("dadg-profile-privacy-v0", PROFILE_PRIVACY_NOTICE_HASH), false);
  assert.equal(isCurrentPrivacyAcceptance(PROFILE_PRIVACY_NOTICE_VERSION, "outro-hash"), false);
});

test("duplicidade concorrente do índice é reconhecida sem inspecionar valores", () => {
  assert.equal(isDuplicateKeyError({ code: 11000, keyPattern: { cpfLookup: 1 } }), true);
  assert.equal(isDuplicateKeyError({ code: 50 }), false);
});

test("toda rota protegida declara student ou admin", () => {
  for (const route of API_ROUTE_MAP) {
    if (!route.isPublic) assert.ok(route.authType === "student" || route.authType === "admin");
  }
  assert.equal(API_ROUTE_MAP.some((route) => "authType" in route && String(route.authType) === "both"), false);
});

test("issuer e audience divergentes são rejeitados", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const issuer = "https://alunos.example.auth0.com/";
  const audience = "https://api.dadg.example/student";
  const token = await new SignJWT({ sub: "auth0|student" }).setProtectedHeader({ alg: "RS256" }).setIssuedAt().setExpirationTime("5m").setIssuer(issuer).setAudience(audience).sign(privateKey);
  await assert.doesNotReject(jwtVerify(token, publicKey, studentJwtVerifyOptions(issuer, audience)));
  await assert.rejects(jwtVerify(token, publicKey, studentJwtVerifyOptions("https://wrong.example/", audience)));
  await assert.rejects(jwtVerify(token, publicKey, studentJwtVerifyOptions(issuer, "wrong-audience")));
});

test("configuração do aluno reutiliza AUTH0_DOMAIN e AUTH0_AUDIENCE", () => {
  const previousDomain = process.env.AUTH0_DOMAIN;
  const previousAudience = process.env.AUTH0_AUDIENCE;

  try {
    process.env.AUTH0_DOMAIN = "alunos.example.auth0.com";
    process.env.AUTH0_AUDIENCE = "https://api.dadg.example";
    const configuration = getStudentAuthConfiguration();
    assert.equal(configuration.issuer, "https://alunos.example.auth0.com/");
    assert.equal(configuration.audience, "https://api.dadg.example");

    delete process.env.AUTH0_AUDIENCE;
    assert.throws(() => getStudentAuthConfiguration(), AuthConfigurationError);
  } finally {
    if (previousDomain === undefined) delete process.env.AUTH0_DOMAIN;
    else process.env.AUTH0_DOMAIN = previousDomain;
    if (previousAudience === undefined) delete process.env.AUTH0_AUDIENCE;
    else process.env.AUTH0_AUDIENCE = previousAudience;
  }
});
