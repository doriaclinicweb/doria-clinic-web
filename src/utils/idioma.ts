export type Idioma = 'es' | 'ca' | 'en';

export const IDIOMAS: Idioma[] = ['es', 'ca', 'en'];

const PREFIJOS: Record<Idioma, string> = { es: '', ca: '/ca', en: '/en' };

export function detectarIdioma(pathname: string): Idioma {
  if (pathname === '/ca' || pathname.startsWith('/ca/')) return 'ca';
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  return 'es';
}

export function prefijoDe(idioma: Idioma): string {
  return PREFIJOS[idioma];
}

export function quitarPrefijo(pathname: string, idioma: Idioma): string {
  if (idioma === 'es') return pathname || '/';
  const sinPrefijo = pathname.slice(PREFIJOS[idioma].length);
  return sinPrefijo || '/';
}

export function rutaEn(pathname: string, destino: Idioma): string {
  const actual = detectarIdioma(pathname);
  const base = quitarPrefijo(pathname, actual);
  return destino === 'es' ? base : PREFIJOS[destino] + base;
}

export function inicioDe(idioma: Idioma): string {
  return idioma === 'es' ? '/' : PREFIJOS[idioma] + '/';
}
