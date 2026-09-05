import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

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

const especialidades = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/especialidades' }),
  schema: ({ image }) =>
    z.object({
      idioma: z.enum(idiomas),
      titulo: z.string(),
      subtitulo: z.string().optional(),
      resumen: z.string().min(80).max(300),
      orden: z.number(),
      icono: z.string().optional(),
      imagen: image().optional(),
      especialista: reference('equipo').optional(),
      destacada: z.boolean().default(false),
      faqs: z.array(faq).default([]),
      seo,
    }),
});

const tratamientos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tratamientos' }),
  schema: ({ image }) =>
    z.object({
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
      imagen: image().optional(),
      actualizado: z.coerce.date(),
      seo,
    }),
});

const equipo = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/equipo' }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      cargo: z.string(),
      numero_colegiado: z.string(),
      titulacion: z.array(z.string()).min(1),
      especialidades: z.array(z.string()),
      foto: image().optional(),
      orden: z.number(),
    }),
});

export const collections = { especialidades, tratamientos, equipo };
