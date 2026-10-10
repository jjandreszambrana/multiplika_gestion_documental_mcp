---
name: fuente-de-verdad-api
description: api_para_frontend.md vive solo en la carpeta compartida; si discrepa del OpenAPI manda el OpenAPI y hay que avisar al backend.
metadata:
  type: reference
---

La guía de la API de contabilidad se movió el 27/08/2026 a
`/home/jjandres/desarrollos/python3/multiplika_compartida/contabilidad/contexto/api_para_frontend.md`.
La mantiene la IA del backend cada vez que cambia un endpoint; aquí se lee y no
se edita. En el repo del frontend ya no hay copia: `docs/contexto/` solo guarda
`UBICACION_api_para_frontend.md`, que apunta allí.

Especificación viva: `https://facturae.multiplika.net/apisif/openapi.json`.

**Por qué:** el documento y el OpenAPI se han desincronizado ya alguna vez (por
ejemplo `/usuarios/me`, que la guía daba como POST y es GET).

**Cómo aplicarlo**, con el matiz que puso el backend el 27/08/2026 en [1.2]: el
`openapi.json` es lo que hay **desplegado** en facturae, que es la instalación de
pruebas, y el documento puede ir por delante. Si el documento describe algo que
el OpenAPI no tiene, es que falta desplegarlo: se avisa y lo suben. Si los dos lo
tienen y no coinciden, manda el OpenAPI y ellos corrigen el documento. En los dos
casos **se avisa por [[canal-con-backend]]** en vez de adaptarse en silencio.
El resto de documentación de diseño del módulo sigue en el repo de SIF, en
`docs/modulo_contabilidad/`, y se pide por el mismo canal.
