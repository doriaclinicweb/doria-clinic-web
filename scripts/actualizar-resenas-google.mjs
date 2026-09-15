#!/usr/bin/env node
// Actualiza google_valoracion y google_num_resenas en src/data/clinica.json
// a partir de la Google Places API (legacy). Pensado para ejecutarse desde
// el workflow .github/workflows/actualizar-resenas-google.yml (mensual),
// pero también se puede lanzar a mano: node scripts/actualizar-resenas-google.mjs
//
// Necesita la variable de entorno GOOGLE_PLACES_API_KEY.
// Opcionalmente, GOOGLE_PLACE_ID (recomendado: evita una llamada extra y
// es más fiable que buscar por nombre). Si no se da, se busca el
// establecimiento por el nombre exacto guardado en clinica.json
// (nombre_google_maps, o nombre si el primero está vacío).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clinicaPath = path.join(__dirname, '../src/data/clinica.json');

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error('Falta la variable de entorno GOOGLE_PLACES_API_KEY.');
  process.exit(1);
}

const clinica = JSON.parse(fs.readFileSync(clinicaPath, 'utf8'));

let placeId = process.env.GOOGLE_PLACE_ID || '';

if (!placeId) {
  const query = clinica.nombre_google_maps || clinica.nombre;
  const findUrl =
    'https://maps.googleapis.com/maps/api/place/findplacefromtext/json' +
    `?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name` +
    `&key=${apiKey}`;
  const findRes = await fetch(findUrl).then((r) => r.json());
  if (findRes.status !== 'OK' || !findRes.candidates?.length) {
    console.error(
      'No se ha podido encontrar el establecimiento automáticamente por el nombre.',
      findRes.status,
      findRes.error_message || ''
    );
    console.error(
      'Solución: añade el secreto/variable GOOGLE_PLACE_ID en el repositorio con el ID exacto ' +
        '(puedes obtenerlo con la herramienta "Place ID Finder" de Google: ' +
        'https://developers.google.com/maps/documentation/places/web-service/place-id).'
    );
    process.exit(1);
  }
  placeId = findRes.candidates[0].place_id;
  console.log(`place_id encontrado automáticamente para "${findRes.candidates[0].name}": ${placeId}`);
}

const detailsUrl =
  'https://maps.googleapis.com/maps/api/place/details/json' +
  `?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total` +
  `&key=${apiKey}`;
const details = await fetch(detailsUrl).then((r) => r.json());

if (details.status !== 'OK') {
  console.error('Error al consultar Place Details:', details.status, details.error_message || '');
  process.exit(1);
}

const { rating, user_ratings_total: numResenas, name } = details.result;
console.log(`Datos obtenidos de Google para "${name}": ${rating} ★, ${numResenas} reseñas.`);

let cambiado = false;
if (typeof rating === 'number' && rating !== clinica.google_valoracion) {
  console.log(`Valoración: ${clinica.google_valoracion} → ${rating}`);
  clinica.google_valoracion = rating;
  cambiado = true;
}
if (typeof numResenas === 'number' && numResenas !== clinica.google_num_resenas) {
  console.log(`Número de reseñas: ${clinica.google_num_resenas} → ${numResenas}`);
  clinica.google_num_resenas = numResenas;
  cambiado = true;
}

if (cambiado) {
  fs.writeFileSync(clinicaPath, JSON.stringify(clinica, null, 2) + '\n');
  console.log('clinica.json actualizado.');
} else {
  console.log('Sin cambios: los datos ya estaban al día.');
}
