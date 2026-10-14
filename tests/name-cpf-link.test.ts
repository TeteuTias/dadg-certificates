import assert from "node:assert/strict";
import test from "node:test";
import * as matching from "../lib/certificates/matching";
import * as publicContract from "../lib/certificates/public-contract";
import { loadIsolated } from "./helpers/isolated";

const { canLinkByNameAndCpf, cpfIsConsistent, normalizeName } = matching;
const CPF = "52998224725";
const OTHER_CPF = "11144477735";

type Json = Record<string, unknown>;

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

function linkRoute(certificates: Json[]) {
  const created: Json[] = [];
  const linked: unknown[] = [];
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
        profile: { _id: "perfil", name: "Ana Souza", cpfEncrypted: {} },
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
      find: (filter: Json) => {
        // Candidatos: liberados e sem dono; demais consultas: todo o acervo do CPF ou dos e-mails.
        const rows = filter.ownerEmail
          ? certificates.filter((c) => new RegExp(String((filter.ownerEmail as Json).$regex), "i").test(String(c.ownerEmail)))
          : certificates.filter((c) => (filter.isReady ? c.isReady && !c.profileId : true) && String(c.ownerCpf).replace(/\D/g, "") === CPF);
        const chain = { limit: () => chain, select: () => chain, lean: async () => rows };
        return chain;
      },
      updateOne: async (filter: Json) => {
        linked.push(filter._id);
        return { modifiedCount: 1 };
      },
    },
    "@/lib/profile/crypto": { decryptCpf: () => CPF },
    "@/lib/certificates/matching": matching,
    "@/lib/certificates/public-contract": publicContract,
    "@/lib/events/rules": { EventError: class extends Error {} },
  });
  return { post: () => route.POST({}), created, linked };
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

test("troca de nome ou CPF devolve à revisão só os vínculos por CPF e nome não revisados", async () => {
  const unset: Json[] = [];
  const claims = [
    { certificateId: "b", status: "APPROVED", history: [] as Json[], save: async () => undefined },
  ];
  let filterSeen: Json = {};
  const review = loadIsolated("lib/certificates/review.ts", {
    mongoose: {
      startSession: async () => ({
        withTransaction: async (run: () => Promise<void>) => run(),
        endSession: async () => undefined,
      }),
    },
    "./Claim": {
      CertificateClaim: {
        exists: async (filter: Json) => {
          filterSeen = filter;
          return true;
        },
        find: () => ({ session: async () => claims }),
      },
    },
    "@/lib/models/CertificateModel": {
      updateOne: async (filter: Json) => {
        unset.push(filter);
        return { modifiedCount: 1 };
      },
    },
  });
  assert.equal(await review.returnNameCpfLinksToReview("perfil"), 1);
  assert.deepEqual(filterSeen, { profileId: "perfil", source: "automatic-name-cpf", status: "APPROVED", reviewedBy: null });
  assert.deepEqual(unset, [{ _id: "b", profileId: "perfil" }]);
  assert.equal(claims[0].status, "PENDING");
  assert.equal(claims[0].history.length, 1);
});
