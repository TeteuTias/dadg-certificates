/** Usuário da sessão do painel (e, por compatibilidade de tipo, o payload do Bearer do aluno). */
export type User = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  roles?: string[];
  // Mesmo contrato aberto do tipo `User` do SDK anterior: handlers leem claims extras do payload do aluno.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type Session = {
  user: User & { roles: string[] };
  id_token: string;
  refresh_token?: string;
  access_token: string;
  /** Segundos desde a época. */
  access_token_expires_at?: number;
};
