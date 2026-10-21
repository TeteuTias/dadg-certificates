import assert from "node:assert/strict";
import test from "node:test";
import {
  certificateSearch,
  escapeSearch,
  publicCertificate,
} from "../lib/certificates/public-contract";
import { canAutoLink } from "../lib/certificates/matching";
import {
  registrationOpen,
  overlaps,
  canSelfCancel,
  verifiedEmail,
} from "../lib/events/rules";
import { safeBlogHtml } from "../lib/blog-html";
import { templateFormat } from "../lib/certificates/file-validation";
test("busca literal e todos os IDs exigem publicação", () => {
  for (const input of [
    "Ana Maria",
    ".*()",
    "a+b",
    "abc@example.com",
    "507f1f77bcf86cd799439011",
  ]) {
    assert.equal(certificateSearch(input).isReady, true);
  }
  assert.equal(new RegExp(escapeSearch(".*()")).test("qualquer texto"), false);
  assert.equal(new RegExp(escapeSearch(".*()")).test(".*()"), true);
  assert.throws(() => certificateSearch("a"));
});
test("DTO não expõe CPF/email/identidade e preserva renderização", () => {
  const result = publicCertificate({
    _id: "x",
    ownerName: "Ana",
    ownerCpf: "secret",
    ownerEmail: "private",
    profileId: "owner",
    certificateHours: "4h",
    verse: { showVerse: true },
    eventId: {
      _id: "y",
      eventName: "Evento",
      styleNameText: { color: "red" },
      registrationCount: 42,
    },
  });
  assert.equal(result.ownerCpf, undefined);
  assert.equal(result.ownerEmail, undefined);
  assert.equal(result.profileId, undefined);
  assert.equal(
    (result.eventId as object).hasOwnProperty("registrationCount"),
    false,
  );
  assert.deepEqual(result.verse, { showVerse: true });
});
test("nome não concede titularidade, CPF e e-mail verificado são necessários", () => {
  const cert = { ownerCpf: "529.982.247-25", ownerEmail: "ana@example.com" };
  assert.equal(canAutoLink(cert, "52998224725", "ana@example.com", true), true);
  assert.equal(
    canAutoLink(cert, "52998224725", "ana@example.com", false),
    false,
  );
  assert.equal(
    canAutoLink(cert, "52998224725", "outra@example.com", true),
    false,
  );
  assert.equal(
    canAutoLink(
      { ownerCpf: "11111111111", ownerEmail: "a@a.com" },
      "11111111111",
      "a@a.com",
      true,
    ),
    false,
  );
});
test("janela de inscrição, conflito e cancelamento preservam regras", () => {
  const now = new Date("2026-10-01");
  const event = {
    isPaid: false,
    statusDetails: {
      status: "PUBLISHED_OPEN",
      registrationStartDate: "2026-09-01",
      registrationEndDate: "2026-10-02",
      timeLine: [{ startDate: "2026-10-03" }],
    },
  };
  assert.equal(registrationOpen(event, now), true);
  assert.equal(registrationOpen({ ...event, archivedAt: now }, now), false);
  assert.equal(canSelfCancel(event, {}, now), true);
  assert.equal(canSelfCancel({ ...event, isPaid: true }, {}, now), false);
  assert.equal(canSelfCancel(event, { checkedIn: true }, now), false);
  assert.equal(
    overlaps(
      [{ startDate: "2026-10-03T10:00Z", endDate: "2026-10-03T11:00Z" }],
      [{ startDate: "2026-10-03T11:00Z", endDate: "2026-10-03T12:00Z" }],
    ),
    false,
  );
});
test("email não verificado bloqueia inscrição", () => {
  assert.throws(() =>
    verifiedEmail({ email: "a@b.com", email_verified: false }),
  );
  assert.equal(
    verifiedEmail({ email: "A@B.com", email_verified: true }),
    "a@b.com",
  );
  // Inscrição aceita e-mail não confirmado, mas ainda exige um e-mail válido.
  assert.equal(
    verifiedEmail({ email: "A@B.com", email_verified: false }, false),
    "a@b.com",
  );
  assert.throws(() => verifiedEmail({ email: "", email_verified: false }, false));
});
test("HTML remove script, handlers e URLs executáveis", () => {
  const html = safeBlogHtml(
    '<p>Texto</p><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)"><a href="javascript:alert(1)">link</a>',
  );
  assert.ok(html.includes("Texto"));
  assert.ok(!/script|onerror|javascript/.test(html));
});
test("upload não confia em extensão ou MIME declarados", () => {
  assert.throws(() => templateFormat(Buffer.from("<html>evil</html>")));
  assert.equal(
    templateFormat(Buffer.from("%PDF-1.7 test")).mime,
    "application/pdf",
  );
  assert.throws(() => templateFormat(new Uint8Array(11 * 1024 * 1024)));
});

test("CSV mantém delimitadores, acentos, aspas e linhas citadas", async () => {
  const { readCertificateSheet } =
    await import("../lib/certificates/read-spreadsheet");
  const bytes = new TextEncoder().encode(
    'NOME;EMAIL\r\n"Ana; Maria";"ana@example.com"\r\n"João\nSilva";"joao@example.com"',
  );
  assert.deepEqual(await readCertificateSheet(bytes.buffer), [
    ["NOME", "EMAIL"],
    ["Ana; Maria", "ana@example.com"],
    ["João\nSilva", "joao@example.com"],
  ]);
});
test("ExcelJS preserva XLSX e gera UUIDs de formatação", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Dados");
  sheet.addRow(["Nome", "Email"]);
  sheet.addRow(["Ana", "ana@example.com"]);
  sheet.addConditionalFormatting({
    ref: "A1:B2",
    rules: [
      {
        type: "dataBar",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
      },
    ],
  });
  const bytes = await book.xlsx.writeBuffer();
  const { readCertificateSheet } =
    await import("../lib/certificates/read-spreadsheet");
  assert.deepEqual(await readCertificateSheet(new Uint8Array(bytes).buffer), [
    ["Nome", "Email"],
    ["Ana", "ana@example.com"],
  ]);
});

test("limite por visitante aceita apenas chave assinada e recente",async()=>{
 const {publicRateLimit}=await import("../lib/security/public-rate-limit");const {createHmac}=await import("node:crypto");const previous=process.env.PUBLIC_PROXY_RATE_LIMIT_SECRET;
 process.env.PUBLIC_PROXY_RATE_LIMIT_SECRET="test-only";const now=1790812800000,key="b".repeat(64),time=String(now);
 const request=new Request("https://fixture.invalid",{headers:{"x-dadg-client-key":key,"x-dadg-client-time":time,"x-dadg-client-signature":createHmac("sha256","test-only").update(`${time}:${key}`).digest("hex")}});
 try{for(let i=0;i<60;i++)assert.equal(publicRateLimit(request,now),true);assert.equal(publicRateLimit(request,now),false);
 request.headers.set("x-dadg-client-signature","0".repeat(64));assert.equal(publicRateLimit(request,now),true);}
 finally{if(previous===undefined)delete process.env.PUBLIC_PROXY_RATE_LIMIT_SECRET;else process.env.PUBLIC_PROXY_RATE_LIMIT_SECRET=previous;}
});
