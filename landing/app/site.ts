export const SITE_ORIGIN = "https://titi-assistente.thiago2013ventura.chatgpt.site";
export const SITE_DESCRIPTION = "IA local para Windows que entende linguagem natural, acompanha o contexto e transforma sua voz em ações no computador.";

export function canonicalUrl(path = "/"): string {
  return new URL(path, `${SITE_ORIGIN}/`).href;
}
