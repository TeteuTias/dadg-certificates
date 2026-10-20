import assert from "node:assert/strict";
import test from "node:test";
import { EventError } from "../lib/events/rules";

test("EventError sem mensagem não expõe o código ao aluno", () => {
  const error = new EventError("INVALID_EVENT_PRICE");
  assert.equal(error.code, "INVALID_EVENT_PRICE");
  assert.equal(error.status, 409);
  assert.equal(error.message, "Não foi possível processar a solicitação.");
  assert.equal(new EventError("X", 404, "Inscrição não encontrada.").message, "Inscrição não encontrada.");
});
