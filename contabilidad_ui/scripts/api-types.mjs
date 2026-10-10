// Descarga el OpenAPI de la API y genera src/api/types.ts.
//
// Existe este script en vez de una llamada directa a openapi-typescript por un
// fallo del backend: algunos esquemas anidan definiciones de Pydantic en
// "$defs" locales y las referencian como "#/$defs/X", que no es una ruta válida
// en el documento raíz. openapi-typescript aborta con "Can't resolve $ref".
//
// Aquí se suben esas definiciones a components.schemas y se reescriben las
// referencias. No se inventa ninguna forma: se mueve lo que ya venía escrito.
// Lo que se repara se imprime, para que el fallo del backend siga a la vista.
// Cuando se arregle allí, este script se sustituye por la llamada directa.

import { writeFile } from 'node:fs/promises'
import openapiTS, { astToString } from 'openapi-typescript'

const URL_SPEC = 'https://facturae.multiplika.net/apisif/openapi.json'
const SALIDA = 'src/api/types.ts'

const respuesta = await fetch(URL_SPEC)
if (!respuesta.ok) {
  throw new Error(`No se pudo descargar el OpenAPI: ${respuesta.status} ${respuesta.statusText}`)
}
const spec = await respuesta.json()

const subidas = []
const reescritas = new Set()
spec.components ??= {}
spec.components.schemas ??= {}

function subirDefs(nodo) {
  if (nodo === null || typeof nodo !== 'object') return
  if (Array.isArray(nodo)) {
    nodo.forEach(subirDefs)
    return
  }
  if (nodo.$defs && typeof nodo.$defs === 'object') {
    for (const [nombre, esquema] of Object.entries(nodo.$defs)) {
      if (!(nombre in spec.components.schemas)) {
        spec.components.schemas[nombre] = esquema
        subidas.push(nombre)
      }
    }
    delete nodo.$defs
  }
  if (typeof nodo.$ref === 'string' && nodo.$ref.startsWith('#/$defs/')) {
    reescritas.add(nodo.$ref)
    nodo.$ref = nodo.$ref.replace('#/$defs/', '#/components/schemas/')
  }
  for (const valor of Object.values(nodo)) subirDefs(valor)
}

subirDefs(spec)

if (reescritas.size > 0 || subidas.length > 0) {
  console.warn(
    `Aviso: el OpenAPI trae referencias "#/$defs/...", que es un fallo del backend.\n` +
      `  Reescritas: ${[...reescritas].join(', ') || 'ninguna'}\n` +
      `  Subidas a components.schemas: ${subidas.join(', ') || 'ninguna (ya estaban)'}`,
  )
}

await writeFile(SALIDA, astToString(await openapiTS(spec)))
console.log(`Generado ${SALIDA}`)
