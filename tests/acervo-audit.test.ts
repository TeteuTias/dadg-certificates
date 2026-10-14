import assert from "node:assert/strict";
import test from "node:test";
import { createAcervoAudit, type AcervoDoc } from "../lib/certificates/acervo-audit";

const ready = (doc: AcervoDoc): AcervoDoc => ({ isReady: true, ...doc });

test("auditoria do acervo classifica CPF, e-mail e o que a busca encontra", () => {
  const audit = createAcervoAudit();
  [
    ready({ ownerCpf: "52998224725", ownerEmail: "ana@x.com", ownerName: "Ana Souza" }),
    ready({ ownerCpf: "529.982.247-25", ownerEmail: "ana@x.com", ownerName: "ANA  SOUZA" }),
    ready({ ownerCpf: "529 982 247 25", ownerEmail: "ana@x.com", ownerName: "Ana Souza" }),
    ready({ ownerCpf: "111.444.777-35", ownerEmail: " bia@x.com ", ownerName: "Bia" }),
    ready({ ownerCpf: "52998224724", ownerEmail: "c@x.com" }),
    ready({ ownerCpf: "11111111111", ownerEmail: "d@x.com" }),
    ready({ ownerCpf: "1234", ownerEmail: "teste" }),
    ready({ ownerCpf: "", ownerEmail: "" }),
    ready({ ownerCpf: { iv: "cifrado" }, ownerEmail: "e@x.com" }),
    ready({ ownerCpf: "52998224725", ownerEmail: "f@x.com", profileId: "perfil" }),
    { ownerCpf: "52998224725", ownerEmail: "g@x.com", isReady: false },
  ].forEach(audit.add);
  const r = audit.result();

  assert.equal(r.total, 11);
  assert.equal(r.liberados, 10);
  assert.equal(r.jaVinculados, 1);
  assert.equal(r.semDonoLiberados, 9);
  assert.equal(r.cpfValido, 4);
  assert.equal(r.cpfValidoEmFormatoQueABuscaNaoAcha, 1);
  assert.equal(r.cpfDigitoVerificadorInvalido, 2, "dígito errado e CPF repetido");
  assert.equal(r.cpfSemOnzeDigitos, 1);
  assert.equal(r.cpfAusenteOuIlegivel, 2, "vazio e cifrado");
  assert.equal(r.emailValido, 7);
  assert.equal(r.emailValidoComEspacosNasPontas, 1);
  assert.equal(r.emailInvalido, 1);
  assert.equal(r.emailAusente, 1);
  assert.equal(r.aptosPelaRegra, 4);
  assert.equal(r.aptosEEncontraveisPelaBusca, 2);
  assert.deepEqual(r.conflitosEntreAptos, {
    cpfsDistintos: 2,
    cpfsComVariosEmails: 0,
    certificadosDeCpfsComVariosEmails: 0,
    emailsComVariosCpfs: 0,
    cpfsComVariosNomes: 0,
  });
});

test("auditoria do acervo aponta CPF com vários e-mails, e-mail com vários CPFs e nomes divergentes", () => {
  const audit = createAcervoAudit();
  [
    ready({ ownerCpf: "52998224725", ownerEmail: "ana@x.com", ownerName: "Ana Souza" }),
    ready({ ownerCpf: "52998224725", ownerEmail: "ana.souza@y.com", ownerName: "Ana Souza" }),
    ready({ ownerCpf: "52998224725", ownerEmail: "ana@x.com", ownerName: "Carlos Lima" }),
    ready({ ownerCpf: "11144477735", ownerEmail: "ana@x.com", ownerName: "Ana Souza" }),
  ].forEach(audit.add);
  const conflicts = audit.result().conflitosEntreAptos;
  assert.equal(conflicts.cpfsDistintos, 2);
  assert.equal(conflicts.cpfsComVariosEmails, 1);
  assert.equal(conflicts.certificadosDeCpfsComVariosEmails, 3);
  assert.equal(conflicts.emailsComVariosCpfs, 1);
  assert.equal(conflicts.cpfsComVariosNomes, 1);
});
