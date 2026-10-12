import { isValidCpf } from "@/lib/profile/validation";
export function canAutoLink(
  certificate: { ownerCpf?: unknown; ownerEmail?: unknown },
  cpf: string,
  email: string,
  verified: boolean,
) {
  const sourceCpf = String(certificate.ownerCpf || "").replace(/\D/g, "");
  return (
    verified &&
    sourceCpf.length === 11 &&
    isValidCpf(sourceCpf) &&
    sourceCpf === cpf &&
    String(certificate.ownerEmail || "")
      .trim()
      .toLowerCase() === email.trim().toLowerCase()
  );
}
