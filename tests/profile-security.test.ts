import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPair, jwtVerify, SignJWT } from "jose";
import { authorizePrincipal } from "../lib/security/authorization";
import { ADMIN_ROLES_CLAIM, isAdmin, isOperator, staffRole } from "../lib/security/isAdmin";
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

test("toda rota protegida declara student, admin ou operator", () => {
  for (const route of API_ROUTE_MAP) {
    if (!route.isPublic)
      assert.ok(["student", "admin", "operator"].includes(route.authType));
  }
  assert.equal(API_ROUTE_MAP.some((route) => "authType" in route && String(route.authType) === "both"), false);
});

test("matriz do operador: presença sim, administração não", () => {
  // Rota de presença: administrador ou operador, sempre por sessão do painel.
  assert.equal(authorizePrincipal("operator", "admin", true, false).authorized, true);
  assert.equal(authorizePrincipal("operator", "admin", false, true).authorized, true);
  assert.equal(authorizePrincipal("operator", "admin", false, false).status, 403);
  assert.equal(authorizePrincipal("operator", "student", false, true).status, 403);
  assert.equal(authorizePrincipal("operator", null, false, false).status, 401);
  // Rota administrativa: a role de operador não basta.
  assert.equal(authorizePrincipal("admin", "admin", false, true).status, 403);
  assert.equal(authorizePrincipal("student", "admin", false, true).status, 403);
});

test("operador exige role própria configurada; administrador prevalece", () => {
  const previousAdmin = process.env.DADG_ADMIN_ROLE_NAME;
  const previousOperator = process.env.DADG_OPERATOR_ROLE_NAME;
  const operatorUser = { sub: "auth0|op", [ADMIN_ROLES_CLAIM]: ["Operador de Presença"] };
  const both = { sub: "auth0|both", [ADMIN_ROLES_CLAIM]: ["Administrador", "Operador de Presença"] };
  try {
    process.env.DADG_ADMIN_ROLE_NAME = "Administrador";
    delete process.env.DADG_OPERATOR_ROLE_NAME;
    assert.equal(isOperator(operatorUser), false);
    assert.equal(staffRole(operatorUser), null);

    process.env.DADG_OPERATOR_ROLE_NAME = "Operador de Presença";
    assert.equal(isOperator(operatorUser), true);
    assert.equal(isAdmin(operatorUser), false);
    assert.equal(staffRole(operatorUser), "operator");
    assert.equal(staffRole(both), "admin");
    assert.equal(staffRole({ sub: "auth0|x", [ADMIN_ROLES_CLAIM]: ["Outra"] }), null);
    assert.equal(staffRole(null), null);
  } finally {
    if (previousAdmin === undefined) delete process.env.DADG_ADMIN_ROLE_NAME;
    else process.env.DADG_ADMIN_ROLE_NAME = previousAdmin;
    if (previousOperator === undefined) delete process.env.DADG_OPERATOR_ROLE_NAME;
    else process.env.DADG_OPERATOR_ROLE_NAME = previousOperator;
  }
});

test("operador alcança só a lista de presença", () => {
  const eventId = "6a92fab72fd46137ff827a87";
  const authTypeFor = (method: string, path: string) =>
    API_ROUTE_MAP.find(
      (route) => new RegExp(route.path).test(path) && (!route.method || route.method === method),
    )?.authType;

  const operatorRoutes: Array<[string, string]> = [
    ["GET", "/presenca"],
    ["GET", `/todosEventos/${eventId}/presenca`],
    ["GET", "/api/v1/events/attendance"],
    ["GET", `/api/v1/events/${eventId}/participants`],
    ["POST", `/api/v1/events/${eventId}/participants`],
    ["POST", `/api/v1/events/${eventId}/checkin/scan`],
    ["PATCH", `/api/v1/events/${eventId}/registration/${eventId}/checkin`],
    ["POST", `/api/v1/events/${eventId}/walkin`],
  ];
  for (const [method, path] of operatorRoutes)
    assert.equal(authTypeFor(method, path), "operator", `${method} ${path}`);

  const adminOnly: Array<[string, string]> = [
    ["GET", "/"],
    ["GET", "/todosEventos"],
    ["GET", `/todosEventos/modificar/${eventId}`],
    ["GET", "/event-payments"],
    ["GET", "/certificate-claims"],
    ["GET", "/usuarios"],
    ["GET", `/api/v1/events/${eventId}/certificates`],
    ["POST", `/api/v1/events/${eventId}/certificates`],
    ["GET", "/api/v1/admin/event-payments"],
    ["POST", "/api/v1/admin/profiles/query"],
    ["PUT", "/api/put/updateEvent"],
    ["GET", "/api/get/allEvents"],
    ["DELETE", `/api/v1/events/${eventId}/participants`],
    ["POST", `/api/v1/events/${eventId}/registration/${eventId}/cancel`],
  ];
  for (const [method, path] of adminOnly)
    assert.equal(authTypeFor(method, path), "admin", `${method} ${path}`);

  // A leitura do QR não aceita mais o código na URL.
  assert.notEqual(authTypeFor("GET", `/api/v1/events/${eventId}/checkin/scan`), "operator");
});

test("resumo do perfil e estado CLAM exigem token de aluno", () => {
  const authTypeFor = (path: string) =>
    API_ROUTE_MAP.find((route) => route.method === "GET" && new RegExp(route.path).test(path))?.authType;

  assert.equal(authTypeFor("/api/v1/user/profile/summary"), "student");
  assert.equal(authTypeFor("/api/v1/selective-processes/6a92fab72fd46137ff827a87/me"), "student");
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
