export type ProfileInput = {
  name: string;
  cpf: string;
  period: number;
  registrationNumber?: string;
  birthDate?: string;
  phone?: string;
  contactEmail?: string;
};

export type ProfileValidationErrors = Partial<
  Record<keyof ProfileInput, string>
>;

export function normalizeCpf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 11) : "";
}

export function isValidCpf(value: unknown): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(9) === Number(cpf[9]) &&
    calculateDigit(10) === Number(cpf[10])
  );
}

export function formatCpf(value: unknown): string {
  const cpf = normalizeCpf(value);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCpf(value: unknown): string {
  const cpf = normalizeCpf(value);
  return cpf.length === 11 ? `***.***.***-${cpf.slice(-2)}` : "Não informado";
}

export function normalizeName(value: unknown): string {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/gu, " ").trim()
    : "";
}

export function validateName(value: unknown): string | null {
  const name = normalizeName(value);
  if (name.length < 5 || name.length > 120) {
    return "Informe o nome completo com 5 a 120 caracteres.";
  }
  if (/[\p{N}\p{Cc}\p{Cf}]/u.test(name) || !/^[\p{L}\p{M}'’ -]+$/u.test(name)) {
    return "O nome deve conter apenas letras, espaços, apóstrofos e hífens.";
  }
  return null;
}

export function validatePeriod(value: unknown): string | null {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 12) {
    return "Selecione um período entre 1 e 12.";
  }
  return null;
}

export function validateProfileInput(value: unknown): {
  data: ProfileInput | null;
  errors: ProfileValidationErrors;
} {
  const body =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const name = normalizeName(body.name);
  const cpf = normalizeCpf(body.cpf);
  const period =
    typeof body.period === "number" ? body.period : Number(body.period);
  const errors: ProfileValidationErrors = {};
  const extra = validateAcademicContact(body);
  Object.assign(errors, extra.errors);

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  if (!isValidCpf(cpf)) errors.cpf = "Informe um CPF válido.";
  const periodError = validatePeriod(period);
  if (periodError) errors.period = periodError;

  return {
    data: Object.keys(errors).length ? null : { name, cpf, period, ...extra.data },
    errors,
  };
}

export function onlyDigits(value: string) { return value.replace(/\D/g, ''); }

export const academicFields = ['registrationNumber', 'birthDate', 'phone', 'contactEmail'] as const;
export function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
}
export function validateAcademicContact(body: Record<string, unknown>) {
  const data: Partial<Record<typeof academicFields[number], string>> = {};
  const errors: ProfileValidationErrors = {};
  for (const field of academicFields) {
    if (!(field in body)) continue; // Older clients preserve existing optional fields.
    if (typeof body[field] !== 'string') { errors[field] = 'Informe um texto válido.'; continue; }
    const value = String(body[field]).trim();
    data[field] = field === 'phone' || field === 'registrationNumber' ? onlyDigits(value) : value;
    if (!value) continue;
    if (field === 'registrationNumber' && (!/^[0-9.\s-]+$/.test(value) || !/^\d{1,40}$/.test(data[field]!))) errors[field] = 'Informe a matrícula / RA com até 40 dígitos.';
    if (field === 'birthDate' && !validBirthDate(value)) errors[field] = 'Informe uma data de nascimento válida.';
    if (field === 'phone' && !/^\d{10,13}$/.test(data[field]!)) errors[field] = 'Informe o telefone com DDD.';
    if (field === 'contactEmail' && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) errors[field] = 'Informe um e-mail válido.';
  }
  return { data, errors };
}
export function missingClamFields(profile: Record<string, unknown> | null) {
  if (!profile) return ['name', 'cpf', 'period', ...academicFields];
  const missing: string[] = [];
  if (validateName(profile.name)) missing.push('name');
  if (!profile.cpfEncrypted || !profile.cpfLookup) missing.push('cpf');
  if (validatePeriod(profile.period)) missing.push('period');
  const checked = validateAcademicContact(profile);
  for (const field of academicFields) if (!checked.data[field] || checked.errors[field]) missing.push(field);
  return missing;
}
