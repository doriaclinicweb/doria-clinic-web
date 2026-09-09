# Doria Clinic — web

Sitio estático en Astro con panel de edición Sveltia sobre el propio repositorio.
El contenido son archivos Markdown; no hay base de datos ni servidor.

## Poner en marcha

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # genera dist/
```

## Estructura

```
src/content.config.ts        Esquema de campos (Zod). Aquí se define qué se puede publicar.
src/content/especialidades/  Una página por especialidad, por idioma
src/content/tratamientos/    Páginas de tratamiento concreto, por idioma
src/content/equipo/          Fichas de los doctores
src/data/clinica.json        Teléfono, dirección, horarios y WhatsApp: se editan aquí una vez
src/pages/                   Plantillas
public/admin/config.yml      Configuración del panel que ve la clínica
```

Un precio o un teléfono se cambia en un único sitio y se actualiza en todas las páginas.

## Publicar

1. Subir el repositorio a GitHub.
2. En `public/admin/config.yml`, cambiar `repo: USUARIO/doria-clinic-web` por la ruta real.
3. Conectar el repositorio a Cloudflare Pages, con comando `npm run build` y carpeta `dist`.
4. Apuntar el dominio a Cloudflare.
5. Registrar la app OAuth de GitHub para que el panel `/admin` acepte login.

## Cómo edita la clínica

Entrando en `doria.clinic/admin` con su cuenta de GitHub. Ve un formulario con
campos etiquetados en castellano, no archivos ni código. Funciona desde el móvil.
Cada guardado es un commit y dispara la publicación.

## Pendiente

- Rellenar `src/data/clinica.json`: teléfono, WhatsApp, dirección, horarios, coordenadas.
- Números de colegiado reales en las fichas de `src/content/equipo/`.
- Precios y duraciones de los tratamientos.
- Traducción al catalán en `src/content/*/ca/`.
- Páginas `/equipo/`, `/la-clinica/` y `/contacto/`.
- Aviso legal, política de privacidad y de cookies antes de publicar.

<!-- prueba de acceso de edición/publicación: 2026-09-09 -->

