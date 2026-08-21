export type ProfileInput = {
  name: string;
  cpf: string;
  period: number;
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

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  if (!isValidCpf(cpf)) errors.cpf = "Informe um CPF válido.";
  const periodError = validatePeriod(period);
  if (periodError) errors.period = periodError;

  return {
    data: Object.keys(errors).length ? null : { name, cpf, period },
    errors,
  };
}
