# Importar datos

En `Utilidades → Importar datos`. Nivel `apuntes`. Título `Importar datos`.

Importa asientos desde CSV y Excel.

## Cómo se usa

1. `Modelo` — «Se definen en «Modelos de importación»». Marcador
   `Ninguno elegido`.
2. `Archivo` — «CSV o Excel (.xlsx), hasta 20 MB». Marcador `Ninguno elegido`.
3. Se **ensaya antes de importar**: la pantalla enseña qué va a pasar y qué
   filas fallan, y solo después se importa de verdad. Al terminar: `Importado.`

**Los modelos se definen aparte y se eligen.** Emparejar columnas en cada
importación se rechazó: quien importa lo hace muchas veces con el mismo formato.
El emparejamiento puede ser por posición cuando el archivo no trae fila de
títulos.

## Detalle técnico que se sale de la norma

**`/importador/subir` no es JSON**: es la única llamada de la API que manda un
formulario con un archivo dentro. La cabecera del tipo la pone el propio
navegador; si se pone a mano, falta la frontera entre las partes y el servidor
no puede leerlo.

## Deshacer

Deshacer una importación borra los asientos que metió, y **es hoy lo único que
borra asientos del libro**, así que es lo que alimenta la pantalla de
`Asientos eliminados`.
