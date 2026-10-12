export class EventError extends Error {
  constructor(
    public code: string,
    public status = 409,
    message = code,
  ) {
    super(message);
  }
}
export function verifiedEmail(user: Record<string, unknown>) {
  const email = user[process.env.STUDENT_AUTH0_EMAIL_CLAIM || "email"];
  const verified =
    user[process.env.STUDENT_AUTH0_EMAIL_VERIFIED_CLAIM || "email_verified"];
  if (
    verified !== true ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new EventError(
      "EMAIL_VERIFICATION_REQUIRED",
      428,
      "Confirme o e-mail da sua conta e entre novamente.",
    );
  return email.trim().toLowerCase();
}
export function overlaps(
  a: { startDate: Date | string; endDate: Date | string }[],
  b: { startDate: Date | string; endDate: Date | string }[],
) {
  return a.some((x) =>
    b.some(
      (y) =>
        new Date(x.startDate) < new Date(y.endDate) &&
        new Date(y.startDate) < new Date(x.endDate),
    ),
  );
}
export function registrationOpen(
  event: {
    archivedAt?: unknown;
    statusDetails?: {
      status?: string;
      registrationStartDate?: Date | string;
      registrationEndDate?: Date | string;
    };
  },
  now = new Date(),
) {
  const d = event.statusDetails;
  return (
    !event.archivedAt &&
    d?.status === "PUBLISHED_OPEN" &&
    !!d.registrationStartDate &&
    !!d.registrationEndDate &&
    new Date(d.registrationStartDate) <= now &&
    new Date(d.registrationEndDate) >= now
  );
}
/**
 * Indica se uma atualização muda a cobrança do evento. Evento gratuito pode
 * estar gravado sem preço ou com preço zero; os dois casos são equivalentes.
 */
export function pricingChanged(
  existing: { isPaid?: boolean; price?: number | null },
  update: { isPaid?: unknown; price?: unknown },
) {
  const paidChanged =
    update.isPaid !== undefined &&
    Boolean(update.isPaid) !== Boolean(existing.isPaid);
  const priceChanged =
    update.price !== undefined &&
    Number(update.price ?? 0) !== Number(existing.price ?? 0);
  return paidChanged || priceChanged;
}
export function canSelfCancel(
  event: {
    isPaid?: boolean;
    statusDetails?: { timeLine?: { startDate: Date | string }[] };
  },
  participant: {
    checkedIn?: boolean;
    certificateId?: unknown;
    status?: string;
  },
  now = new Date(),
) {
  const starts =
    event.statusDetails?.timeLine?.map((t) =>
      new Date(t.startDate).getTime(),
    ) || [];
  return (
    !event.isPaid &&
    !participant.checkedIn &&
    !participant.certificateId &&
    participant.status !== "CANCELLED" &&
    starts.length > 0 &&
    Math.min(...starts) > now.getTime()
  );
}
