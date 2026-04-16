export const COORDENADORIA_EMAILS = {
  CLEV: "clevimepacaraguari@gmail.com",
  CLAM: "clam.certificados@gmail.com",
  CAEP: "caepimepac2022@gmail.com",
  CAES: "caes.dadg@gmail.com",
  EVENTOS: "eventos.dadg@gmail.com",
} as const;

export const COORDENADORIAS = [
  { sigla: "CLEV", email: COORDENADORIA_EMAILS.CLEV },
  { sigla: "CLAM", email: COORDENADORIA_EMAILS.CLAM },
  { sigla: "CAEP", email: COORDENADORIA_EMAILS.CAEP },
  { sigla: "CAES", email: COORDENADORIA_EMAILS.CAES },
  { sigla: "EVENTOS", email: COORDENADORIA_EMAILS.EVENTOS },
] as const;

export const EMAIL_TESTE = "certificados.dadg@gmail.com";

export type CoordenadoriaKey = keyof typeof COORDENADORIA_EMAILS;
export type AvisoTipo = "pre" | "pos";

export const ALL_AVISOS = [
  "3_dias",
  "2_dias",
  "1_dia",
  "documentacao_faltando",
  "vencido",
  "teste",
  "customizado",
] as const;

export type AvisoCode = (typeof ALL_AVISOS)[number];

export type AvisoOption = {
  value: AvisoCode;
  label: string;
  description: string;
  helper: string;
};

export type AvisosPayload = {
  token?: string;
  tipo: AvisoTipo;
  aviso: AvisoCode;
  nomeEvento?: string;
  destinatarios: CoordenadoriaKey[];
  assuntoCustomizado?: string;
  mensagemCustomizada?: string;
};

export type ValidatedAvisosPayload = {
  tipo: AvisoTipo;
  aviso: AvisoCode;
  nomeEvento: string;
  destinatarios: CoordenadoriaKey[];
  assuntoCustomizado: string;
  mensagemCustomizada: string;
};

export const AVISO_GROUPS: Record<AvisoTipo, AvisoOption[]> = {
  pre: [
    {
      value: "documentacao_faltando",
      label: "Documentacao faltando",
      description: "Cobra o envio dos documentos pendentes que ainda nao chegaram.",
      helper: "Mensagem automatica para regularizacao da documentacao faltante.",
    },
    {
      value: "teste",
      label: "Teste",
      description: "Disparo controlado para validar a integracao do sistema.",
      helper: `Ignora as coordenadorias marcadas e envia apenas para ${EMAIL_TESTE}.`,
    },
    {
      value: "customizado",
      label: "Customizado",
      description: "Permite escrever assunto e mensagem manualmente para o disparo.",
      helper: "Exige assunto e mensagem antes de liberar o envio.",
    },
  ],
  pos: [
    {
      value: "3_dias",
      label: "Prazo acabando em 3 dias",
      description: "Comunicado preventivo para acelerar o envio da documentacao.",
      helper: "Mensagem automatica informando que o prazo termina em 3 dias.",
    },
    {
      value: "2_dias",
      label: "Prazo acabando em 2 dias",
      description: "Lembrete de reforco para evitar pendencias perto do prazo final.",
      helper: "Mensagem automatica informando que o prazo termina em 2 dias.",
    },
    {
      value: "1_dia",
      label: "Prazo acabando em 1 dia",
      description: "Aviso urgente para as coordenadorias priorizarem o envio.",
      helper: "Mensagem automatica com tom de urgencia para o ultimo dia util.",
    },
    {
      value: "vencido",
      label: "Prazo vencido - justificar atraso",
      description: "Solicitacao de justificativa e previsao de envio dos documentos.",
      helper: "Mensagem automatica pedindo justificativa de atraso apos o vencimento.",
    },
    {
      value: "documentacao_faltando",
      label: "Documentacao faltando",
      description: "Cobra o envio dos documentos pendentes que ainda nao chegaram.",
      helper: "Mensagem automatica para regularizacao da documentacao faltante.",
    },
    {
      value: "teste",
      label: "Teste",
      description: "Disparo controlado para validar a integracao do sistema.",
      helper: `Ignora as coordenadorias marcadas e envia apenas para ${EMAIL_TESTE}.`,
    },
    {
      value: "customizado",
      label: "Customizado",
      description: "Permite escrever assunto e mensagem manualmente para o disparo.",
      helper: "Exige assunto e mensagem antes de liberar o envio.",
    },
  ],
};

const DIACRITICS_REGEX = /[\u0300-\u036f]/g;

export function normalizeAvisoText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "");
}

export function normalizeSigla(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "");
}

export function getDefaultAvisoByType(tipo: AvisoTipo): AvisoCode {
  return tipo === "pre" ? "customizado" : "3_dias";
}

export function isAvisoAllowedForType(tipo: AvisoTipo, aviso: AvisoCode): boolean {
  return AVISO_GROUPS[tipo].some((option) => option.value === aviso);
}

export function getAppsScriptTipo(tipo: AvisoTipo, aviso: AvisoCode): AvisoTipo {
  return tipo;
}

export function resolveAvisoTargetEmails({
  aviso,
  destinatarios,
}: Pick<ValidatedAvisosPayload, "aviso" | "destinatarios">): string[] {
  if (aviso === "teste") {
    return [EMAIL_TESTE];
  }

  return destinatarios
    .map((sigla) => COORDENADORIA_EMAILS[sigla])
    .filter(Boolean);
}

function isAvisoTipo(value: string): value is AvisoTipo {
  return value === "pre" || value === "pos";
}

function isAvisoCode(value: string): value is AvisoCode {
  return ALL_AVISOS.includes(value as AvisoCode);
}

function isCoordenadoriaKey(value: string): value is CoordenadoriaKey {
  return value in COORDENADORIA_EMAILS;
}

export function validateAvisosPayload(
  payload: unknown,
): { success: true; data: ValidatedAvisosPayload } | { success: false; message: string } {
  if (!payload || typeof payload !== "object") {
    return { success: false, message: "Body invalido para o disparo de avisos." };
  }

  const rawPayload = payload as Partial<AvisosPayload>;
  const tipo = normalizeAvisoText(rawPayload.tipo);
  const aviso = normalizeAvisoText(rawPayload.aviso);

  if (!isAvisoTipo(tipo)) {
    return { success: false, message: "Selecione um tipo de aviso valido." };
  }

  if (!isAvisoCode(aviso)) {
    return { success: false, message: "Selecione uma opcao de aviso valida." };
  }

  if (!isAvisoAllowedForType(tipo, aviso)) {
    return { success: false, message: "A opcao escolhida nao pertence ao tipo selecionado." };
  }

  const destinatarios = Array.isArray(rawPayload.destinatarios)
    ? Array.from(
        new Set(
          rawPayload.destinatarios
            .map((value) => normalizeSigla(value))
            .filter((value): value is CoordenadoriaKey => isCoordenadoriaKey(value)),
        ),
      )
    : [];

  if (aviso !== "teste" && destinatarios.length === 0) {
    return { success: false, message: "Selecione ao menos uma coordenadoria destinataria." };
  }

  const nomeEvento = String(rawPayload.nomeEvento ?? "").trim();
  const assuntoCustomizado = String(rawPayload.assuntoCustomizado ?? "").trim();
  const mensagemCustomizada = String(rawPayload.mensagemCustomizada ?? "").trim();

  if (aviso === "customizado") {
    if (!assuntoCustomizado) {
      return { success: false, message: "Informe o assunto customizado antes de enviar." };
    }

    if (!mensagemCustomizada) {
      return { success: false, message: "Informe a mensagem customizada antes de enviar." };
    }
  }

  return {
    success: true,
    data: {
      tipo,
      aviso,
      nomeEvento,
      destinatarios,
      assuntoCustomizado,
      mensagemCustomizada,
    },
  };
}
