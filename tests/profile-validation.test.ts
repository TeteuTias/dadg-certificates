import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidCpf,
  normalizeName,
  validateName,
  validatePeriod,
  validateProfileInput,
} from "../lib/profile/validation";

test("valida os dois dígitos verificadores do CPF", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("normaliza Unicode e colapsa espaços do nome", () => {
  assert.equal(normalizeName("  Maria   D’Ávila  "), "Maria D’Ávila");
  assert.equal(validateName("Maria D’Ávila"), null);
  assert.match(validateName("Maria 2") || "", /apenas letras/);
  assert.match(validateName("Ana") || "", /5 a 120/);
});

test("aceita somente períodos inteiros de 1 a 12", () => {
  assert.equal(validatePeriod(1), null);
  assert.equal(validatePeriod(12), null);
  assert.ok(validatePeriod(0));
  assert.ok(validatePeriod(13));
  assert.ok(validatePeriod(1.5));
});

test("validação agregada devolve erros por campo", () => {
  const invalid = validateProfileInput({ name: "A1", cpf: "123", period: 13 });
  assert.equal(invalid.data, null);
  assert.deepEqual(Object.keys(invalid.errors).sort(), [
    "cpf",
    "name",
    "period",
  ]);
});
