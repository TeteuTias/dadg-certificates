export const PUBLIC_CERTIFICATE_FIELDS = [
  "_id",
  "ownerName",
  "eventName",
  "certificateHours",
  "certificatePath",
  "frontTopperText",
  "frontBottomText",
  "isReady",
  "onlyImage",
  "verse",
] as const;
const EVENT_FIELDS = [
  "_id",
  "eventName",
  "eventDescription",
  "styleContainer",
  "styleContainerVerse",
  "styleFrontTopperText",
  "styleFrontBottomText",
  "styleNameText",
  "templatePath",
  "templateVersePath",
  "useStatementFormat",
  "eventType",
];
export function publicCertificate(value: Record<string, unknown>) {
  const dto: Record<string, unknown> = {};
  for (const key of PUBLIC_CERTIFICATE_FIELDS)
    if (value[key] !== undefined) dto[key] = value[key];
  if (
    value.eventId &&
    typeof value.eventId === "object" &&
    "eventName" in value.eventId
  ) {
    dto.eventId = Object.fromEntries(
      EVENT_FIELDS.filter((key) => key in (value.eventId as object)).map(
        (key) => [key, (value.eventId as Record<string, unknown>)[key]],
      ),
    );
  } else dto.eventId = value.eventId;
  return dto;
}
export function escapeSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function certificateSearch(value: string) {
  const search = value.trim();
  if (search.length < 3 || search.length > 120)
    throw new Error("Informe entre 3 e 120 caracteres.");
  if (/^[0-9a-f]{24}$/i.test(search))
    return { isReady: true, $or: [{ _id: search }, { eventId: search }] };
  const literal = escapeSearch(search);
  return {
    isReady: true,
    $or: [
      { ownerName: { $regex: literal, $options: "i" } },
      { eventName: { $regex: literal, $options: "i" } },
      { ownerCpf: search },
      { ownerEmail: { $regex: `^${literal}$`, $options: "i" } },
    ],
  };
}
