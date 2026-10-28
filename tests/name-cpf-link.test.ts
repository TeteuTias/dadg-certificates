import assert from "node:assert/strict";
import test from "node:test";
import * as matching from "../lib/certificates/matching";
import * as publicContract from "../lib/certificates/public-contract";
import { loadIsolated } from "./helpers/isolated";

const { canLinkByNameAndCpf, cpfIsConsistent, normalizeName } = matching;
const CPF = "52998224725";
const OTHER_CPF = "11144477735";

type Json = Record<string, unknown>;

test("CPF do acervo é lido em qualquer formato, como número e sem os zeros à esquerda", () => {
  const { certificateCpf, cpfSearchFilter } = matching;
  for (const stored of ["52998224725", "529.982.247-25", "529 982 247 25", "529.982.247/25", 52998224725])
    assert.equal(certificateCpf(stored), CPF, String(stored));
  for (const stored of ["1234567890", "123.456.789-0", 1234567890]) assert.equal(certificateCpf(stored), "01234567890", String(stored));
  assert.equal(certificateCpf("52998224724"), "", "dígito verificador errado");
  assert.equal(certificateCpf("5299822472"), "", "dígito perdido no meio não vira CPF válido");
  assert.equal(certificateCpf({ cifrado: true }), "");

  const filter = cpfSearchFilter("01234567890") as { $or: [{ ownerCpf: { $regex: string } }, { ownerCpf: number }] };
  const pattern = new RegExp(filter.$or[0].ownerCpf.$regex);
  for (const stored of ["01234567890", "012.345.678-90", "1234567890", "123.456.789-0", " 1234567890 "])
    assert.ok(pattern.test(stored), stored);
  assert.equal(pattern.test("11234567890"), false);
  assert.equal(filter.$or[1].ownerCpf, 1234567890);
});

test("nome comparável ignora acento, caixa e espaços extras", () => {
  assert.equal(normalizeName("  Ána   SOUZA "), "ana souza");
  assert.equal(normalizeName(null), "");
});

test("vínculo por CPF e nome exige CPF válido igual e nome completo idêntico", () => {
  const cert = { ownerCpf: "529.982.247-25", ownerName: "Ana Souza" };
  assert.equal(canLinkByNameAndCpf(cert, CPF, "ANA  souza"), true);
  assert.equal(canLinkByNameAndCpf(cert, CPF, "Ana"), false, "nome de uma palavra não basta");
  assert.equal(canLinkByNameAndCpf(cert, CPF, "Ana S. Souza"), false);
  assert.equal(canLinkByNameAndCpf(cert, OTHER_CPF, "Ana Souza"), false);
  assert.equal(canLinkByNameAndCpf({ ownerCpf: "11111111111", ownerName: "Ana Souza" }, "11111111111", "Ana Souza"), false);
  assert.equal(canLinkByNameAndCpf(cert, "", "Ana Souza"), false);
});

test("CPF com nomes diferentes ou e-mail usado por outro CPF não vincula por nome", () => {
  const same = [{ ownerName: "Ana Souza" }, { ownerName: "ANA SOUZA" }, { ownerName: "" }];
  assert.equal(cpfIsConsistent(same, [{ ownerCpf: CPF }, { ownerCpf: "" }, { ownerCpf: "123" }], CPF), true);
  assert.equal(cpfIsConsistent([...same, { ownerName: "Carlos Lima" }], [], CPF), false);
  assert.equal(cpfIsConsistent(same, [{ ownerCpf: "111.444.777-35" }], CPF), false);
});

function linkRoute(certificates: Json[], profileUnchanged = true) {
  const created: Json[] = [];
  const linked: unknown[] = [];
  const nativeFilters: Json[] = [];
  const fences: Json[] = [];
  const route = loadIsolated("app/api/v1/user/certificates/link/route.ts", {
    mongoose: {
      startSession: async () => ({
        withTransaction: async (run: () => Promise<void>) => run(),
        endSession: async () => undefined,
      }),
    },
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": {
      eventIdentity: async () => ({
        profile: { _id: "perfil", name: "Ana Souza", cpfLookup: "lookup", cpfEncrypted: {} },
        email: "conta@x.com",
      }),
    },
    "@/lib/certificates/Claim": {
      CertificateClaim: {
        findById: () => ({ session: async () => null }),
        create: async (docs: Json[]) => {
          created.push(...docs);
        },
      },
    },
    "@/lib/models/CertificateModel": {
      // Busca por CPF: só pelo driver nativo, que não converte o ramo numérico do filtro.
      collection: {
        find: (filter: Json) => {
          nativeFilters.push(filter);
          const rows = certificates.filter(
            (c) => (filter.isReady ? c.isReady && !c.profileId : true) && matching.certificateCpf(c.ownerCpf) === CPF,
          );
          const cursor = { sort: () => cursor, toArray: async () => rows };
          return cursor;
        },
      },
      // Busca por e-mail (conferência de outro CPF usando o mesmo e-mail).
      find: (filter: Json) => {
        if (!filter.ownerEmail) throw new Error("busca por CPF não pode passar pelo cast do Mongoose");
        const rows = certificates.filter((c) => new RegExp(String((filter.ownerEmail as Json).$regex), "i").test(String(c.ownerEmail)));
        const chain = { select: () => chain, lean: async () => rows };
        return chain;
      },
      updateOne: async (filter: Json) => {
        linked.push(filter._id);
        return { modifiedCount: 1 };
      },
    },
    "@/lib/models/UserProfileModel": {
      // Cerca: escrita condicionada à identidade avaliada.
      updateOne: async (filter: Json, update: Json) => {
        fences.push({ filter, update });
        return { matchedCount: profileUnchanged ? 1 : 0 };
      },
    },
    "@/lib/profile/crypto": { decryptCpf: () => CPF },
    "@/lib/certificates/matching": matching,
    "@/lib/certificates/public-contract": publicContract,
    "@/lib/events/rules": { EventError: class extends Error {} },
  });
  return { post: () => route.POST({}), created, linked, nativeFilters, fences };
}

async function withAutoLink(run: () => Promise<void>) {
  const previous = process.env.CERTIFICATE_AUTO_LINK_ENABLED;
  process.env.CERTIFICATE_AUTO_LINK_ENABLED = "true";
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATE_AUTO_LINK_ENABLED;
    else process.env.CERTIFICATE_AUTO_LINK_ENABLED = previous;
  }
}

const cert = (id: string, extra: Json): Json => ({ _id: id, isReady: true, ownerCpf: CPF, ownerName: "Ana Souza", ...extra });

test("rota vincula por e-mail e, com e-mail diferente, por CPF e nome com origem própria", () =>
  withAutoLink(async () => {
    const { post, created, linked } = linkRoute([
      cert("a", { ownerEmail: "conta@x.com" }),
      cert("b", { ownerEmail: "antigo@y.com", ownerName: "ANA SOUZA" }),
      cert("c", { ownerEmail: "antigo@y.com", isReady: false }),
    ]);
    const body = await (await post()).json();
    assert.equal(body.linked, 2);
    assert.deepEqual(linked, ["a", "b"]);
    assert.deepEqual(created.map((c) => c.source), ["automatic", "automatic-name-cpf"]);
  }));

test("rota acha CPF gravado como número e busca pelo driver nativo com o ramo numérico intacto", () =>
  withAutoLink(async () => {
    const { post, linked, nativeFilters, fences } = linkRoute([
      cert("n", { ownerCpf: Number(CPF), ownerEmail: "conta@x.com" }),
    ]);
    assert.equal((await (await post()).json()).linked, 1);
    assert.deepEqual(linked, ["n"]);
    const numeric = (nativeFilters[0].$or as Json[]).find((branch) => typeof branch.ownerCpf === "number");
    assert.equal(numeric?.ownerCpf, Number(CPF));
    // Cerca no perfil com a identidade avaliada, sem mexer no updatedAt.
    assert.deepEqual(fences[0], {
      filter: { _id: "perfil", cpfLookup: "lookup", name: "Ana Souza" },
      update: { $inc: { __v: 1 } },
    });
  }));

test("rota para quando nome ou CPF do perfil mudaram no meio do processo", () =>
  withAutoLink(async () => {
    const { post, created, linked, fences } = linkRoute(
      [cert("a", { ownerEmail: "conta@x.com" }), cert("b", { ownerEmail: "conta@x.com" })],
      false,
    );
    assert.equal((await (await post()).json()).linked, 0);
    assert.deepEqual(created, []);
    assert.deepEqual(linked, []);
    assert.equal(fences.length, 1, "não tenta os certificados seguintes");
  }));

test("rota não vincula por nome quando o acervo do CPF tem conflito", () =>
  withAutoLink(async () => {
    const emailOfOtherCpf = linkRoute([
      cert("a", { ownerEmail: "conta@x.com" }),
      cert("b", { ownerEmail: "antigo@y.com" }),
      { _id: "d", isReady: true, profileId: "outro", ownerCpf: OTHER_CPF, ownerName: "Bia Lima", ownerEmail: "antigo@y.com" },
    ]);
    assert.equal((await (await emailOfOtherCpf.post()).json()).linked, 1);
    assert.deepEqual(emailOfOtherCpf.created.map((c) => c.source), ["automatic"]);

    // Uma variação do nome no acervo do CPF (até abreviação) basta para ir à revisão manual.
    const nameVariant = linkRoute([
      cert("b", { ownerEmail: "antigo@y.com" }),
      cert("c", { ownerEmail: "antigo@y.com", ownerName: "Ana S. Souza", isReady: false }),
    ]);
    assert.equal((await (await nameVariant.post()).json()).linked, 0);
  }));

test("pedido manual guarda o e-mail informado como evidência e recusa e-mail inválido", async () => {
  const upserts: Json[] = [];
  let existingClaim = false;
  const route = loadIsolated("app/api/v1/user/certificates/claims/route.ts", {
    "next/server": {},
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: "perfil" } }) },
    "@/lib/certificates/Claim": {
      CertificateClaim: {
        countDocuments: async () => 0,
        updateOne: async (_filter: Json, update: Json) => {
          upserts.push(update.$setOnInsert as Json);
          return { upsertedCount: existingClaim ? 0 : 1 };
        },
      },
    },
    "@/lib/models/CertificateModel": {
      findOne: () => ({ select: () => ({ lean: async () => ({ _id: "6a92fab72fd46137ff827a87" }) }) }),
    },
    "@/lib/events/rules": { EventError: class extends Error {} },
    "@/lib/certificates/matching": matching,
  });
  const post = (body: Json) =>
    route.POST({ json: async () => ({ certificateId: "6a92fab72fd46137ff827a87", message: "Participei deste evento.", ...body }) });

  assert.equal((await post({ evidenceEmail: "teste" })).status, 400);
  assert.equal((await post({ evidenceEmail: " Antigo@Y.com " })).status, 200);
  assert.equal(upserts[0].evidenceEmail, "antigo@y.com");
  assert.equal((await post({})).status, 200);
  assert.equal("evidenceEmail" in upserts[1], false);

  // Pedido repetido não finge sucesso, e corpo que não é JSON é erro do cliente.
  existingClaim = true;
  assert.equal((await post({})).status, 409);
  assert.equal((await route.POST({ json: async () => { throw new SyntaxError("x"); } })).status, 400);
});

test("troca de nome ou CPF devolve à revisão só os vínculos por CPF e nome não revisados", async () => {
  const unset: Json[] = [];
  const claims = [
    { certificateId: "b", status: "APPROVED", history: [] as Json[], save: async () => undefined },
  ];
  let filterSeen: Json = {};
  const sessionsSeen: unknown[] = [];
  const session = { id: "sessão da gravação do perfil" };
  const review = loadIsolated("lib/certificates/review.ts", {
    "./Claim": {
      CertificateClaim: {
        find: (filter: Json) => {
          filterSeen = filter;
          return {
            session: async (s: unknown) => {
              sessionsSeen.push(s);
              return claims;
            },
          };
        },
      },
    },
    "@/lib/models/CertificateModel": {
      updateOne: async (filter: Json, _update: Json, options: Json) => {
        unset.push(filter);
        sessionsSeen.push(options.session);
        return { modifiedCount: 1 };
      },
    },
  });
  assert.equal(await review.returnNameCpfLinksToReview("perfil", false, session), 1);
  // Tudo na sessão recebida: a devolução faz parte da transação que grava o perfil.
  assert.deepEqual(sessionsSeen, [session, session]);
  assert.deepEqual(filterSeen, { profileId: "perfil", source: "automatic-name-cpf", status: "APPROVED", reviewedBy: null });
  assert.deepEqual(unset, [{ _id: "b", profileId: "perfil" }]);
  assert.equal(claims[0].status, "PENDING");
  assert.equal(claims[0].history.length, 1);

  // CPF trocado: os vínculos por CPF e e-mail também voltam para revisão.
  await review.returnNameCpfLinksToReview("perfil", true, session);
  assert.deepEqual(filterSeen, {
    profileId: "perfil",
    source: { $in: ["automatic", "automatic-name-cpf"] },
    status: "APPROVED",
    reviewedBy: null,
  });
});
