import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAcademicContact } from '../lib/profile/validation';
test('normalizes RA and phone before persistence, retaining leading zeros', () => {
  const checked=validateAcademicContact({registrationNumber:'00.012-3',phone:'+55 (34) 99999-1234'});
  assert.deepEqual(checked.errors,{});
  assert.equal(checked.data.registrationNumber,'000123');
  assert.equal(checked.data.phone,'5534999991234');
});
test('rejects nonnumeric, empty-after-normalization and overlong RA', () => {
  for(const registrationNumber of ['ABC','---','=2+2','1'.repeat(41)]) assert.ok(validateAcademicContact({registrationNumber}).errors.registrationNumber);
});
test('older clients can omit contact fields', () => {
  assert.deepEqual(validateAcademicContact({}),{data:{},errors:{}});
});
