import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const idiomas = ['es', 'ca', 'en'] as const;

const seo = z.object({
  titulo_seo: z.string().max(60),
  meta_descripcion: z.string().max(155),
  noindex: z.boolean().default(false),
});

const faq = z.object({
  pregunta: z.string(),
  respuesta: z.string(),
});

const paso = z.object({
  titulo: z.string(),
  descripcion: z.string(),
  duracion: z.string().optional(),
});

const caso = z.object({
  antes: z.string(),
  despues: z.string(),
  descripcion: z.string(),
  consentimiento_firmado: z.literal(true),
});

const hito = z.object({
  fecha: z.string(),
  texto: z.string(),
  enlace: z.string().optional(),
});

const especialidades = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/especialidades' }),
  schema: z.object({
    idioma: z.enum(idiomas),
    titulo: z.string(),
    subtitulo: z.string().optional(),
    resumen: z.string().min(80).max(300),
    resumen_corto: z.string().max(130).optional(),
    orden: z.number(),
    mostrar_en_home: z.boolean().default(true),
    icono: z.string().optional(),
    imagen: z.string().optional(),
    especialista: reference('equipo').optional(),
    faqs: z.array(faq).default([]),
    seo,
  }),
});

const tratamientos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tratamientos' }),
  schema: z.object({
    idioma: z.enum(idiomas),
    titulo: z.string(),
    especialidad: reference('especialidades'),
    resumen: z.string().min(80).max(300),
    precio_desde: z.number().nullish(),
    financiacion_meses: z.number().nullish(),
    duracion_sesion: z.string().optional(),
    numero_sesiones: z.string().optional(),
    anestesia: z.enum(['no', 'local', 'sedacion']).optional(),
    especialista: reference('equipo'),
    cuando_se_indica: z.array(z.string()).min(2),
    proceso: z.array(paso).optional(),
    faqs: z.array(faq).default([]),
    casos: z.array(caso).default([]),
    imagen: z.string().optional(),
    actualizado: z.coerce.date(),
    seo,
  }),
});

const equipo = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/equipo' }),
  schema: z.object({
    nombre: z.string(),
    numero_colegiado: z.string(),
    orden: z.number(),
    foto: z.string().optional(),
    cargo: z.string(),
    cargo_ca: z.string().optional(),
    cargo_en: z.string().optional(),
    titulacion: z.array(z.string()).min(1),
    titulacion_ca: z.array(z.string()).default([]),
    titulacion_en: z.array(z.string()).default([]),
    especialidades: z.array(z.string()).default([]),
    bio: z.string().optional(),
    bio_ca: z.string().optional(),
    bio_en: z.string().optional(),
    trayectoria: z.array(z.string()).default([]),
    trayectoria_ca: z.array(z.string()).default([]),
    trayectoria_en: z.array(z.string()).default([]),
    agenda: z.array(hito).default([]),
    agenda_ca: z.array(hito).default([]),
    agenda_en: z.array(hito).default([]),
    noindex: z.boolean().default(false),
  }),
});

const imagen = z.object({ src: z.string(), alt: z.string() });
const home = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/home' }),
  schema: z.object({
    idioma: z.enum(idiomas),
    hero_titular: z.string(),
    hero_entradilla: z.string(),
    hero_imagenes: z.array(imagen).min(1),
    cta_texto: z.string(),
    intro_frase: z.string(),
    intro_parrafos: z.array(z.string()).min(1),
    tratamientos_titulo: z.string(),
    equipo_titulo: z.string(),
    elegirnos_titulo: z.string(),
    elegirnos: z.array(z.object({ titulo: z.string(), texto: z.string() })).min(1),
    instalaciones_titulo: z.string(),
    instalaciones_texto: z.string(),
    instalaciones_imagenes: z.array(imagen).min(1),
    seo,
  }),
});

const paginas = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/paginas' }),
  schema: z.object({
    idioma: z.enum(idiomas),
    ruta: z.string(),
    titulo: z.string(),
    lede: z.string().optional(),
    actualizado: z.string().optional(),
    seo,
  }),
});

const listados = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/listados' }),
  schema: z.object({
    idioma: z.enum(idiomas),
    pagina: z.enum(['especialidades', 'tratamientos']),
    h1: z.string(),
    lede: z.string(),
    faqs_titulo: z.string(),
    faqs: z.array(faq).default([]),
    seo,
  }),
});

export const collections = { especialidades, tratamientos, equipo, home, paginas, listados };
