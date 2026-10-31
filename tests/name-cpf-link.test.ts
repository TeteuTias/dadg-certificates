import assert from "node:assert/strict";
import test from "node:test";
import * as matching from "../lib/certificates/matching";
import * as publicContract from "../lib/certificates/public-contract";
import { evaluateLinks, type RawCertificate } from "../lib/certificates/auto-link";
import { loadIsolated } from "./helpers/isolated";

const { nameKey, ownerNames, profileEmails, certificateEvidence } = matching;
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
  assert.equal(certificateCpf("52998224725@x.com"), "", "e-mail não vira CPF");

  const filter = cpfSearchFilter("01234567890") as unknown as { $or: Array<Record<string, { $regex: string } | number>> };
  const pattern = new RegExp((filter.$or[0].ownerCpf as { $regex: string }).$regex);
  for (const stored of ["01234567890", "012.345.678-90", "1234567890", "123.456.789-0", " 1234567890 "])
    assert.ok(pattern.test(stored), stored);
  assert.equal(pattern.test("11234567890"), false);
  assert.equal(filter.$or[1].ownerCpf, 1234567890);
  // Colunas trocadas: o mesmo CPF também é procurado no campo do e-mail.
  assert.deepEqual(filter.$or[2], { ownerEmail: filter.$or[0].ownerCpf });
  assert.equal(filter.$or[3].ownerEmail, 1234567890);
});

test("nome comparável ignora acento, caixa, pontuação e partículas", () => {
  assert.equal(nameKey("  Gianluca Zambiazi da Sá Rocha "), "gianluca zambiazi sa rocha");
  assert.equal(nameKey("GIANLUCA ZAMBIAZI DE SA ROCHA"), "gianluca zambiazi sa rocha");
  assert.equal(nameKey("Ana S. Souza"), "ana s souza", "abreviação continua diferente");
  assert.equal(nameKey(null), "");
});

test("trabalho em conjunto separa os donos sem quebrar nome com 'e'", () => {
  assert.deepEqual(ownerNames("Ana Souza e Bia Lima"), { joint: true, keys: ["ana souza bia lima", "ana souza", "bia lima"] });
  assert.deepEqual(ownerNames("Ana Souza, Bia Lima & Caio Reis").keys.slice(1), ["ana souza", "bia lima", "caio reis"]);
  assert.deepEqual(ownerNames("João Pedro e Silva"), { joint: false, keys: ["joao pedro silva"] });
  assert.deepEqual(ownerNames("Ana Souza"), { joint: false, keys: ["ana souza"] });
});

test("evidência lê CPF e e-mail nos dois campos e e-mails do perfil incluem os institucionais", () => {
  const ev = certificateEvidence({ ownerCpf: "Contato@X.com", ownerEmail: "529.982.247-25", ownerName: "Ana Souza" });
  assert.deepEqual(ev.cpfs, [CPF]);
  assert.deepEqual(ev.emails, ["contato@x.com"]);
  assert.deepEqual(certificateEvidence({ ownerCpf: "000", ownerEmail: "00.@00" }).emails, []);
  assert.deepEqual(
    [...profileEmails({ name: "Ana de Souza", registrationNumber: "2426520012", contactEmail: " Contato@X.com " }, "Conta@X.com")],
    ["conta@x.com", "contato@x.com", "2426520012@aluno.imepac.edu.br", "ana.souza@aluno.imepac.edu.br"],
  );
  assert.deepEqual([...profileEmails({ name: "Ana" }, "")], [], "nome de uma palavra não gera e-mail antigo");
});

const PROFILE = { _id: "perfil", name: "Ana Souza", registrationNumber: "2426520012", contactEmail: "contato@x.com" };
const ctx = (extra: Partial<Parameters<typeof evaluateLinks>[1]> = {}) => ({
  profileId: "perfil",
  cpf: CPF,
  name: PROFILE.name,
  emails: profileEmails(PROFILE, "conta@x.com"),
  ...extra,
});
const doc = (id: string, extra: Partial<RawCertificate>): RawCertificate => ({ _id: id, isReady: true, ownerName: "Ana Souza", ...extra });
const summary = (result: ReturnType<typeof evaluateLinks>) => ({
  approve: Object.fromEntries(result.approve.map((m) => [m.id, m.source])),
  review: result.review.map((m) => m.id),
});

test("regras A–D ligam os casos do acervo real: colunas trocadas, e-mail antigo, só nome e conjunto", () => {
  const docs = [
    // Já do aluno pelo CPF: comprova o e-mail antigo@y.com.
    doc("m", { profileId: "perfil", ownerCpf: CPF, ownerEmail: "antigo@y.com" }),
    doc("trocado", { ownerCpf: "contato@x.com", ownerEmail: "529.982.247-25" }),
    doc("institucional", { ownerCpf: 13, ownerEmail: "Ana.Souza@aluno.imepac.edu.br", ownerName: "ANA SOUZA" }),
    doc("comprovado", { ownerCpf: "", ownerEmail: " antigo@y.com ", ownerName: "Ana de Souza" }),
    doc("so-nome", { ownerCpf: "TI", ownerEmail: " " }),
    doc("conjunto", { profileId: "outro", ownerCpf: "000", ownerEmail: "00.@00", ownerName: "Ana da Souza e Bia Lima" }),
    doc("nao-liberado", { isReady: false, ownerCpf: "contato@x.com", ownerEmail: CPF }),
    doc("de-outro", { profileId: "outro", ownerCpf: CPF, ownerEmail: "conta@x.com" }),
    doc("outro-nome", { ownerCpf: "", ownerEmail: "", ownerName: "Bia Lima" }),
  ];
  assert.deepEqual(summary(evaluateLinks(docs, ctx())), {
    approve: {
      trocado: "automatic",
      institucional: "automatic-email-name",
      comprovado: "automatic-email-name",
      "so-nome": "automatic-name",
      conjunto: "automatic-name",
    },
    review: [],
  });
});

test("CPF: vincula com e-mail do aluno ou com nome se o acervo do CPF não tem conflito", () => {
  const byName = doc("b", { ownerCpf: CPF, ownerEmail: "velho@q.com" });
  assert.deepEqual(summary(evaluateLinks([byName], ctx())).approve, { b: "automatic-name-cpf" });
  // Um nome diferente no acervo do CPF (não é o do perfil abreviado) basta para não vincular por nome.
  const variant = doc("v", { isReady: false, ownerCpf: CPF, ownerName: "Bia Souza" });
  assert.deepEqual(summary(evaluateLinks([byName, variant], ctx())), { approve: {}, review: [] });
  // Nome abreviado ou completo do mesmo aluno não é conflito (caso "…da Silva" sem o último sobrenome).
  for (const same of ["Ana S. Souza", "Ana Maria Souza", "ANA SOUZA"])
    assert.deepEqual(
      summary(evaluateLinks([byName, doc("v", { isReady: false, ownerCpf: CPF, ownerName: same })], ctx())).approve,
      { b: "automatic-name-cpf" },
      same,
    );
  // E-mail do CPF usado por outro CPF também é conflito.
  const shared = doc("s", { isReady: false, ownerCpf: OTHER_CPF, ownerEmail: "velho@q.com", ownerName: "Bia Lima" });
  assert.deepEqual(summary(evaluateLinks([byName, shared], ctx())).approve, {});
  // Com e-mail do aluno o CPF basta.
  assert.deepEqual(summary(evaluateLinks([doc("e", { ownerCpf: CPF, ownerEmail: "2426520012@aluno.imepac.edu.br", ownerName: "X Y" })], ctx())).approve, {
    e: "automatic",
  });
});

test("só nome vai para revisão quando o nome tem outro CPF ou nenhum no acervo", () => {
  const nameOnly = doc("n", { ownerCpf: "", ownerEmail: "" });
  const homonym = doc("h", { ownerCpf: OTHER_CPF, ownerEmail: "bia@z.com" });
  const both = summary(evaluateLinks([nameOnly, homonym, doc("m", { profileId: "perfil", ownerCpf: CPF })], ctx()));
  assert.deepEqual(both, { approve: {}, review: ["n"] }, "certificado com CPF de outro homônimo não é do aluno");
  assert.deepEqual(summary(evaluateLinks([nameOnly], ctx())), { approve: {}, review: ["n"] }, "nome sem nenhum CPF conhecido");
  assert.deepEqual(summary(evaluateLinks([nameOnly], ctx({ name: "Ana" }))), { approve: {}, review: [] }, "nome de uma palavra não basta");
});

test("nome abreviado em um certificado do CPF não trava os certificados só com o nome do aluno", () => {
  const profile = ctx({ name: "Giovanna Gabrielly da Silva Fernandes" });
  const mine = (id: string, name: string, extra: Partial<RawCertificate> = {}) =>
    doc(id, { ownerCpf: CPF, ownerEmail: "velho@q.com", ownerName: name, profileId: "perfil", ...extra });
  const nameOnly = doc("n", { ownerCpf: "Ligas", ownerEmail: " ", ownerName: "Giovanna Gabrielly da Silva Fernandes" });
  const docs = [mine("a", "Giovanna Gabrielly da Silva"), mine("b", "Giovanna Gabrielly da Silva Fernandes"), nameOnly];
  assert.deepEqual(summary(evaluateLinks(docs, profile)), { approve: { n: "automatic-name" }, review: [] });

  // Maioria: um nome fora do padrão entre 5 não derruba o CPF; 2 entre 4 derrubam.
  const four = ["a", "b", "c", "d"].map((id) => mine(id, "Giovanna Gabrielly da Silva Fernandes"));
  const odd = mine("x", "Bia Lima");
  assert.deepEqual(summary(evaluateLinks([...four, odd, nameOnly], profile)).approve, { n: "automatic-name" });
  const half = [mine("a", "Giovanna Gabrielly da Silva Fernandes"), mine("b", "Giovanna Gabrielly da Silva Fernandes"), odd, mine("y", "Caio Reis")];
  assert.deepEqual(summary(evaluateLinks([...half, nameOnly], profile)), { approve: {}, review: ["n"] });
  assert.equal(
    evaluateLinks([...half, nameOnly], profile).review[0].reason,
    "Os certificados com o CPF do aluno têm nomes diferentes do perfil",
  );
  // Certificado sem nome no acervo do CPF não conta como nome diferente.
  assert.deepEqual(summary(evaluateLinks([mine("a", ""), mine("b", "Giovanna Gabrielly da Silva Fernandes"), nameOnly], profile)).approve, {
    n: "automatic-name",
  });
});

test("nome do perfil que não bate com o acervo do CPF nunca vincula: perfil com nome e CPF trocados", () => {
  // Quem digita o próprio nome mas o CPF de outra pessoa: o acervo daquele CPF tem outro nome.
  const theirs = [1, 2, 3, 4].map((n) => doc(`t${n}`, { profileId: "outro", ownerCpf: CPF, ownerEmail: `t${n}@z.com`, ownerName: "Bia Lima" }));
  const nameOnly = doc("n", { ownerCpf: "", ownerEmail: "", ownerName: "Ana Souza" });
  const unknown = doc("u", { ownerCpf: "", ownerEmail: "novo@q.com", ownerName: "Ana Souza" });
  assert.deepEqual(summary(evaluateLinks([...theirs, nameOnly, unknown], ctx())), { approve: {}, review: ["n", "u"] });
  // Nem o nome só com o CPF de outro homônimo vira vínculo.
  const homonym = doc("h", { isReady: false, ownerCpf: OTHER_CPF, ownerEmail: "ana@z.com", ownerName: "Ana Souza" });
  assert.deepEqual(summary(evaluateLinks([homonym, nameOnly, unknown], ctx())), { approve: {}, review: ["n", "u"] });
  assert.equal(
    evaluateLinks([homonym, nameOnly], ctx()).review[0].reason,
    "Nome completo do aluno aparece no acervo com o CPF de outra pessoa",
  );
});

test("e-mail sem CPF: o do aluno vincula, o de outro CPF bloqueia e o desconhecido vai para revisão", () => {
  const otherCpfDoc = doc("o", { isReady: false, ownerCpf: OTHER_CPF, ownerEmail: "bia@z.com", ownerName: "Bia Lima" });
  assert.deepEqual(summary(evaluateLinks([doc("x", { ownerCpf: "", ownerEmail: "bia@z.com" }), otherCpfDoc], ctx())), {
    approve: {},
    review: [],
  });
  assert.deepEqual(summary(evaluateLinks([doc("u", { ownerCpf: "", ownerEmail: "novo@q.com" })], ctx())), { approve: {}, review: ["u"] });
  // E-mail desconhecido vincula quando o nome, no acervo, só aparece com o CPF do aluno.
  const mine = doc("m", { profileId: "perfil", ownerCpf: CPF, ownerEmail: "contato@x.com" });
  assert.deepEqual(summary(evaluateLinks([doc("u", { ownerCpf: "", ownerEmail: "novo@q.com" }), mine], ctx())).approve, {
    u: "automatic-name-unknown-email",
  });
  // E-mail de outra pessoa (sem CPF em lugar nenhum) no certificado com o nome do aluno: revisão.
  const shared = (id: string, name: string, email: string) => doc(id, { isReady: id === "f1", ownerCpf: "", ownerEmail: email, ownerName: name });
  const withOther = evaluateLinks([shared("f1", "Ana Souza", "caio@z.com"), shared("f2", "Caio Reis", "caio@z.com"), mine], ctx());
  assert.deepEqual(summary(withOther), { approve: {}, review: ["f1"] });
  assert.equal(withOther.review[0].reason, "Nome completo do aluno com e-mail que aparece no acervo com outros nomes");
  // E-mail de preenchimento (3 ou mais pessoas) vale como e-mail ausente: a regra do nome decide.
  const filler = [shared("f1", "Ana Souza", "11111@gmail.com"), shared("f2", "Caio Reis", "11111@gmail.com"), shared("f3", "Bia Lima", "11111@gmail.com")];
  assert.deepEqual(summary(evaluateLinks([...filler, mine], ctx())).approve, { f1: "automatic-name" });
  assert.deepEqual(summary(evaluateLinks(filler, ctx())), { approve: {}, review: ["f1"] }, "sem o CPF do aluno no acervo, nome sozinho não basta");
  // Com o nome também em outro CPF, volta para a revisão.
  const homonymCpf = doc("h", { isReady: false, ownerCpf: OTHER_CPF, ownerEmail: "bia@z.com" });
  assert.deepEqual(summary(evaluateLinks([doc("u", { ownerCpf: "", ownerEmail: "novo@q.com" }), mine, homonymCpf], ctx())), {
    approve: {},
    review: ["u"],
  });
  const myEmailElsewhere = doc("c", { isReady: false, ownerCpf: OTHER_CPF, ownerEmail: "contato@x.com", ownerName: "Bia Lima" });
  assert.deepEqual(summary(evaluateLinks([doc("k", { ownerCpf: "", ownerEmail: "contato@x.com" }), myEmailElsewhere], ctx())), {
    approve: {},
    review: ["k"],
  });
});

test("conjunto com CPF de outra pessoa vai para revisão; certificado individual de outro dono nunca", () => {
  const joint = doc("j", { ownerCpf: OTHER_CPF, ownerName: "Ana Souza e Bia Lima" });
  const taken = doc("t", { profileId: "outro", ownerCpf: "", ownerEmail: "" });
  assert.deepEqual(summary(evaluateLinks([joint, taken, doc("m", { profileId: "perfil", ownerCpf: CPF })], ctx())), {
    approve: {},
    review: ["j"],
  });
});

function linkLib(
  docs: RawCertificate[],
  opts: { fence?: boolean; decided?: string[]; suggested?: string[]; extra?: RawCertificate[] } = {},
) {
  const store = docs.map((d) => ({ ...d }));
  const created: Json[] = [];
  const upgrades: Json[] = [];
  // Decisão anterior (manual, admin) ou sugestão automática ainda pendente.
  const claims = [
    ...(opts.decided ?? []).map((_id) => ({ _id, status: "APPROVED", source: "manual", reviewedBy: "admin" })),
    ...(opts.suggested ?? []).map((_id) => ({ _id, status: "PENDING", source: "automatic-suggestion" })),
  ];
  const nativeFilters: Json[] = [];
  const fences: Json[] = [];
  const updates: Json[] = [];
  const lib = loadIsolated("lib/certificates/auto-link.ts", {
    mongoose: {
      startSession: async () => ({
        withTransaction: async (run: () => Promise<void>) => run(),
        endSession: async () => undefined,
      }),
    },
    "@/lib/certificates/Claim": {
      CertificateClaim: {
        find: (filter: Json) => {
          const ids = (filter._id as Json).$in as string[];
          const chain = { select: () => chain, session: () => chain, lean: async () => claims.filter((c) => ids.includes(c._id)) };
          return chain;
        },
        insertMany: async (rows: Json[]) => void created.push(...rows),
        bulkWrite: async (ops: Json[]) => void upgrades.push(...ops),
      },
    },
    "@/lib/models/CertificateModel": {
      // Busca só pelo driver nativo: a primeira traz o acervo do aluno, a segunda o dos e-mails comprovados.
      collection: {
        find: (filter: Json) => {
          nativeFilters.push(filter);
          const rows = nativeFilters.length === 1 ? store : (opts.extra ?? []);
          const cursor = { toArray: async () => rows };
          return cursor;
        },
      },
      updateMany: async (filter: Json, update: Json) => {
        updates.push(filter);
        const ids = (filter._id as Json).$in as unknown[];
        for (const d of store) if (ids.includes(d._id) && d.isReady && !d.profileId) d.profileId = (update.$set as Json).profileId;
        return {};
      },
      find: (filter: Json) => {
        const ids = (filter._id as Json).$in as unknown[];
        const rows = store.filter((d) => ids.includes(d._id) && d.isReady);
        const chain = { select: () => chain, session: () => chain, lean: async () => rows };
        return chain;
      },
    },
    "@/lib/models/UserProfileModel": {
      updateOne: async (filter: Json, update: Json, options: Json) => {
        fences.push({ filter, update, timestamps: options.timestamps });
        return { matchedCount: opts.fence === false ? 0 : 1 };
      },
    },
    "@/lib/profile/crypto": { decryptCpf: () => CPF },
    "@/lib/certificates/matching": matching,
    "@/lib/certificates/public-contract": publicContract,
  });
  const run = () =>
    (lib.linkCertificatesForProfile as unknown as (p: Json, e: string) => Promise<{ linked: number; review: number }>)(
      { ...PROFILE, cpfLookup: "lookup", cpfEncrypted: {} },
      "conta@x.com",
    );
  return { run, store, created, upgrades, nativeFilters, fences, updates };
}

test("vínculo grava tudo numa transação, com cerca no perfil e decisões anteriores preservadas", async () => {
  const { run, store, created, nativeFilters, fences, updates } = linkLib(
    [
      doc("a", { ownerCpf: Number(CPF), ownerEmail: "conta@x.com" }),
      doc("b", { ownerCpf: CPF, ownerEmail: "conta@x.com" }),
      doc("j", { profileId: "outro", ownerCpf: "", ownerEmail: "", ownerName: "Ana Souza e Bia Lima" }),
      doc("u", { ownerCpf: "", ownerEmail: "novo@q.com" }),
      doc("k", { ownerCpf: OTHER_CPF, ownerEmail: "", ownerName: "Ana Souza e Bia Lima" }),
    ],
    { decided: ["perfil:b"] },
  );
  assert.deepEqual(await run(), { linked: 3, review: 1 });
  // Ramo numérico do CPF intacto (sem cast do Mongoose) e busca por e-mail e nome na mesma consulta.
  const or = nativeFilters[0].$or as Json[];
  assert.ok(or.some((branch) => branch.ownerCpf === Number(CPF)));
  assert.ok(or.some((branch) => branch.ownerName));
  assert.equal(updates.length, 1, "um updateMany para o lote inteiro");
  assert.deepEqual(fences, [
    {
      filter: { _id: "perfil", cpfLookup: "lookup", name: "Ana Souza", registrationNumber: "2426520012", contactEmail: "contato@x.com" },
      update: { $inc: { __v: 1 } },
      timestamps: false,
    },
  ]);
  assert.deepEqual(
    created.map((c) => [c._id, c.status, c.source]),
    [
      ["perfil:a", "APPROVED", "automatic"],
      ["perfil:j", "APPROVED", "automatic-name"],
      ["perfil:u", "APPROVED", "automatic-name-unknown-email"],
      ["perfil:k", "PENDING", "automatic-suggestion"],
    ],
  );
  assert.equal(store.find((d) => d._id === "a")?.profileId, "perfil");
  assert.equal(store.find((d) => d._id === "j")?.profileId, "outro", "conjunto mantém o outro dono; o vínculo fica na solicitação");
  assert.equal(store.find((d) => d._id === "b")?.profileId, undefined, "decisão anterior tem precedência");
});

test("sugestão automática pendente vira vínculo quando as regras passam a aprovar; decisões humanas não", async () => {
  const { run, store, created, upgrades } = linkLib(
    [
      doc("m", { profileId: "perfil", ownerCpf: CPF, ownerEmail: "contato@x.com" }),
      doc("s", { ownerCpf: "Ligas", ownerEmail: " " }),
      doc("d", { ownerCpf: "", ownerEmail: "" }),
      doc("r", { ownerCpf: OTHER_CPF, ownerEmail: "bia@z.com", ownerName: "Ana Souza e Bia Lima" }),
    ],
    { suggested: ["perfil:s", "perfil:r"], decided: ["perfil:d"] },
  );
  assert.deepEqual(await run(), { linked: 1, review: 0 });
  assert.deepEqual(created, [], "nada novo: as sugestões já existiam e a decisão humana vale");
  assert.equal(upgrades.length, 1);
  const op = (upgrades[0] as { updateOne: { filter: Json; update: { $set: Json; $push: { history: Json } } } }).updateOne;
  assert.deepEqual(op.filter, { _id: "perfil:s", status: "PENDING", source: "automatic-suggestion", reviewedBy: null });
  assert.equal(op.update.$set.status, "APPROVED");
  assert.equal(op.update.$set.source, "automatic-name");
  assert.equal(op.update.$push.history.actor, "automatic");
  assert.match(String(op.update.$push.history.reason), /^Reavaliado: /);
  assert.equal(store.find((d) => d._id === "s")?.profileId, "perfil");
  assert.equal(store.find((d) => d._id === "d")?.profileId, undefined, "decisão humana tem precedência");
  assert.equal(store.find((d) => d._id === "r")?.profileId, undefined);
});

test("vínculo busca o resto do acervo dos e-mails comprovados pelo CPF", async () => {
  const { run, created, nativeFilters } = linkLib([doc("m", { profileId: "perfil", ownerCpf: CPF, ownerEmail: "antigo@y.com" })], {
    extra: [doc("p", { ownerCpf: "", ownerEmail: "antigo@y.com" })],
  });
  assert.deepEqual(await run(), { linked: 1, review: 0 });
  assert.equal(nativeFilters.length, 2);
  assert.match(JSON.stringify(nativeFilters[1]), /antigo@y\\\\.com/);
  assert.deepEqual(created.map((c) => c.source), ["automatic-email-name"]);
});

test("vínculo não grava nada quando o perfil mudou no meio do processo", async () => {
  const { run, created, updates } = linkLib([doc("a", { ownerCpf: CPF, ownerEmail: "conta@x.com" })], { fence: false });
  assert.deepEqual(await run(), { linked: 0, review: 0 });
  assert.deepEqual(created, []);
  assert.deepEqual(updates, []);
});

test("rota de vínculo exige a flag e devolve o resultado da função", async () => {
  const calls: unknown[] = [];
  const route = loadIsolated("app/api/v1/user/certificates/link/route.ts", {
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: "perfil" }, email: "conta@x.com" }) },
    "@/lib/certificates/auto-link": {
      linkCertificatesForProfile: async (...args: unknown[]) => {
        calls.push(args);
        return { linked: 3, review: 1 };
      },
    },
    "@/lib/events/rules": { EventError: class extends Error {} },
  });
  const previous = process.env.CERTIFICATE_AUTO_LINK_ENABLED;
  try {
    delete process.env.CERTIFICATE_AUTO_LINK_ENABLED;
    assert.equal((await route.POST({})).status, 409);
    process.env.CERTIFICATE_AUTO_LINK_ENABLED = "true";
    assert.deepEqual(await (await route.POST({})).json(), { linked: 3, review: 1 });
    assert.deepEqual(calls, [[{ _id: "perfil" }, "conta@x.com"]]);
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATE_AUTO_LINK_ENABLED;
    else process.env.CERTIFICATE_AUTO_LINK_ENABLED = previous;
  }
});

test("pedido manual guarda o e-mail informado como evidência e recusa e-mail inválido", async () => {
  const upserts: Json[] = [];
  const counted: Json[] = [];
  let existingClaim = false;
  let certificate: Json = { _id: "6a92fab72fd46137ff827a87" };
  const route = loadIsolated("app/api/v1/user/certificates/claims/route.ts", {
    "next/server": {},
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: "perfil" } }) },
    "@/lib/certificates/Claim": {
      CertificateClaim: {
        countDocuments: async (filter: Json) => {
          counted.push(filter);
          return 0;
        },
        updateOne: async (_filter: Json, update: Json) => {
          upserts.push(update.$setOnInsert as Json);
          return { upsertedCount: existingClaim ? 0 : 1 };
        },
      },
    },
    "@/lib/models/CertificateModel": {
      findOne: () => ({ select: () => ({ lean: async () => certificate }) }),
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
  // Sugestões automáticas pendentes não contam no limite de pedidos do aluno.
  assert.equal(counted[0].source, "manual");

  // Certificado de outro dono só aceita pedido quando é trabalho em conjunto.
  certificate = { _id: "6a92fab72fd46137ff827a87", profileId: "outro", ownerName: "Bia Lima" };
  assert.equal((await post({})).status, 409);
  certificate = { _id: "6a92fab72fd46137ff827a87", profileId: "outro", ownerName: "Bia Lima e Ana Souza" };
  assert.equal((await post({})).status, 200);

  // Pedido repetido não finge sucesso, e corpo que não é JSON é erro do cliente.
  existingClaim = true;
  assert.equal((await post({})).status, 409);
  assert.equal((await route.POST({ json: async () => { throw new SyntaxError("x"); } })).status, 400);
});

test("aluno pede a remoção de um certificado que não é dele: só do que está na conta, sem duplicar", async () => {
  const CERT = "6a92fab72fd46137ff827a87";
  const updates: Array<{ filter: Json; update: Json }> = [];
  let claim: Json | null = null; // vínculo aprovado já registrado
  let ownedByCertificate = false; // vínculo antigo, só com profileId no certificado
  let open = 0; // pedidos de remoção abertos do aluno
  let modified = 1;
  let upserted = 1;
  const route = loadIsolated("app/api/v1/user/certificates/removal/route.ts", {
    "next/server": {},
    "@/lib/security/route-access": { withRouteAccess: (fn: unknown) => fn },
    "@/lib/events/identity": { eventIdentity: async () => ({ profile: { _id: "perfil" } }) },
    "@/lib/certificates/Claim": {
      CertificateClaim: {
        findOne: () => ({ select: () => ({ lean: async () => claim }) }),
        countDocuments: async () => open,
        updateOne: async (filter: Json, update: Json) => {
          updates.push({ filter, update });
          return { modifiedCount: modified, upsertedCount: upserted };
        },
      },
    },
    "@/lib/models/CertificateModel": { exists: async () => (ownedByCertificate ? { _id: CERT } : null) },
    "@/lib/events/rules": { EventError: class extends Error {} },
  });
  const post = (body: Json = {}) => route.POST({ json: async () => ({ certificateId: CERT, ...body }) });

  assert.equal((await post({ certificateId: "x" })).status, 400);
  assert.equal((await post({ message: "a".repeat(1001) })).status, 400);
  assert.equal((await post()).status, 404, "certificado que não está na conta do aluno");

  // Vínculo já registrado: o pedido entra no registro existente, sem tirar o certificado ainda.
  claim = { _id: `perfil:${CERT}` };
  assert.equal((await post({ message: "  Não participei.  " })).status, 200);
  const first = updates[0];
  assert.equal(first.filter._id, `perfil:${CERT}`);
  assert.equal(first.filter.status, "APPROVED");
  const set = (first.update.$set as Json).removal as Json;
  assert.equal(set.message, "Não participei.");
  assert.ok(set.requestedAt instanceof Date);
  assert.equal((first.update.$push as { history: Json }).history.status, "APPROVED", "o vínculo segue aprovado até o administrador decidir");
  assert.equal(JSON.stringify(first.update).includes("REVOKED"), false);

  // Sem comentário: o campo da mensagem nem é gravado.
  assert.equal((await post()).status, 200);
  assert.equal("message" in ((updates[1].update.$set as Json).removal as Json), false);

  // Pedido já aberto ou gravado ao mesmo tempo por outro clique: 409.
  claim = { _id: `perfil:${CERT}`, removal: { requestedAt: new Date() } };
  assert.equal((await post()).status, 409);
  claim = { _id: `perfil:${CERT}` };
  modified = 0;
  assert.equal((await post()).status, 409);
  modified = 1;

  // Limite de pedidos abertos.
  open = 20;
  assert.equal((await post()).status, 429);
  open = 0;

  // Vínculo antigo, sem registro: o registro nasce aprovado, com o pedido.
  claim = null;
  ownedByCertificate = true;
  const before = updates.length;
  assert.equal((await post()).status, 200);
  const created = updates[before];
  const insert = created.update.$setOnInsert as Json;
  assert.equal(insert.status, "APPROVED");
  assert.equal(insert.profileId, "perfil");
  assert.equal((insert.history as Json[]).length, 2);
  assert.ok((insert.removal as Json).requestedAt instanceof Date);
  upserted = 0;
  assert.equal((await post()).status, 409);
});

test("troca de dados do perfil devolve à revisão só os vínculos automáticos que dependiam deles", async () => {
  const unset: Json[] = [];
  const claims = [{ certificateId: "b", status: "APPROVED", history: [] as Json[], save: async () => undefined }];
  const filters: Json[] = [];
  const sessionsSeen: unknown[] = [];
  const session = { id: "sessão da gravação do perfil" };
  const review = loadIsolated("lib/certificates/review.ts", {
    "./Claim": {
      CertificateClaim: {
        find: (filter: Json) => {
          filters.push(filter);
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
  const sources = () => ((filters.at(-1) as Json).source as Json).$in;
  assert.equal(await review.returnAutomaticLinksToReview("perfil", { name: true }, session), 1);
  // Tudo na sessão recebida: a devolução faz parte da transação que grava o perfil.
  assert.deepEqual(sessionsSeen, [session, session]);
  assert.deepEqual(filters[0], {
    profileId: "perfil",
    source: { $in: ["automatic-name-cpf", "automatic-email-name", "automatic-name", "automatic-name-unknown-email"] },
    status: "APPROVED",
    reviewedBy: null,
  });
  assert.deepEqual(unset, [{ _id: "b", profileId: "perfil" }]);
  assert.equal(claims[0].status, "PENDING");
  assert.equal(claims[0].history.length, 1);

  await review.returnAutomaticLinksToReview("perfil", { cpf: true }, session);
  assert.deepEqual(sources(), [
    "automatic",
    "automatic-name-cpf",
    "automatic-email-name",
    "automatic-name",
    "automatic-name-unknown-email",
  ]);
  await review.returnAutomaticLinksToReview("perfil", { contact: true }, session);
  assert.deepEqual(sources(), ["automatic-email-name"]);
  // Nada mudou que importe ao vínculo: nem consulta.
  assert.equal(await review.returnAutomaticLinksToReview("perfil", {}, session), 0);
  assert.equal(filters.length, 3);
});
