# Qué datos entran en el modelo 303

Escrito el 02/09/2026, antes de montar la pantalla. Sale de los tipos generados
del OpenAPI y del apartado 17 quater de `api_para_frontend.md`.

Esto es **el resumen de los datos**, no el diseño de la pantalla: qué trae cada
llamada, qué se queda fuera y qué no llega todavía.

---

## La declaración: cabecera

Lo que devuelven `/declaraciones/preparar` y `/declaraciones/obtener` además de
las casillas. Es lo que identifica el documento.

| Campo | Qué es | Hoy |
|---|---|---|
| `id` | La declaración | |
| `modelo` | Modelo de la AEAT | siempre `303` |
| `ejercicio`, `periodo` | Lo declarado. Periodo `01`–`12` o `1T`–`4T` | |
| `secuencia` | 1 la primera del periodo; 2 y siguientes, las que la rectifican | siempre 1 |
| `estado` | 0 borrador · 1 confirmada · 2 presentada · 3 sustituida | **siempre 0** |
| `resultado` | El importe | |
| `tipo_resultado` | `ingresar`, `compensar`, `devolver` o `sin_actividad` | |
| `fecha_calculo` | Cuándo se preparó | |
| `fecha_presentacion`, `justificante` | De la presentación ante la AEAT | siempre vacíos |
| `asiento` | Asiento de la liquidación | siempre 0 |
| `version_aeat`, `version_programa` | Con qué diseño se calculó | |

Cuatro campos vienen siempre vacíos porque confirmar y presentar todavía no
existen. No se pintan columnas para ellos.

## La declaración: las casillas

`casillas` es una lista, y **cada elemento trae solo esto**:

| Campo | Qué es |
|---|---|
| `pagina` | Página del modelo como la nombra la AEAT: `01000`, `03000` |
| `casilla` | Número: `01`, `29`, `46` |
| `importe` | Lo declarado en esa casilla |
| `texto` | Solo para las casillas que no son importes |

**No trae el rótulo de la casilla ni el orden en que van.** Sin eso la pantalla
es una columna de números con corchetes al lado. Es lo primero que hay que
pedir al backend.

Tampoco está documentado **qué casillas concretas rellena** entre la [01] y la
[46]: hay que verlo llamando o preguntarlo. Lo que sí dice el backend:

- **Llega hasta la [46]**, el resultado del régimen general.
- Las ventas exentas se colocan: las del artículo 25 en la **[59]** y las de los
  artículos 21, 22, 23 y 24 en la **[60]**.
- **No** hay compensaciones de periodos anteriores, ni prorratas, ni fichero
  para la AEAT, ni asiento de la liquidación.

## Lo que se queda fuera: los avisos

Lo que el programa no sabe colocar con certeza **no lo coloca**. `avisos` trae
una línea por cada cosa apartada:

| Campo | Qué es |
|---|---|
| `ref_tipo` | `factura_emitida` o `factura_recibida_sii` |
| `ref_id` | La factura |
| `id_linea` | La línea de su desglose |
| `importe` | Lo que se queda fuera de la declaración |
| `motivo` | Ya redactado, para enseñarlo tal cual |

Se apartan hoy: operaciones no sujetas, la venta exenta «por otros» —la que no
dice por qué lo está—, los regímenes especiales, las adquisiciones
intracomunitarias, la inversión del sujeto pasivo en compras, el IVA no
deducible y cualquier tipo de IVA que el 303 de 2026 no reconozca.

**La factura solo viene identificada por su id interno.** Ni número de factura,
ni fecha, ni nombre del tercero. Un aviso que dice «recibida 4471» no sirve para
ir a arreglar nada.

## De una casilla a sus facturas

`/declaraciones/documentos`, con `id_declaracion`, `casilla` (vacío = todas),
`limite` (200 por defecto, 5.000 máximo) y `desplazamiento`. Devuelve `total` y
una página de:

| Campo | Qué es |
|---|---|
| `ref_tipo`, `ref_id`, `id_linea` | La línea de factura |
| `casilla_base`, `casilla_cuota` | A qué casillas fue cada parte |
| `base`, `cuota`, `recargo` | Lo que se llevó |

Mismo problema de identificación que en los avisos, y aquí pesa más: es la
lista que se le enseña a Hacienda ante un requerimiento.

## Un cambio de criterio que afecta a lo que enseñamos

La **factura recibida** entra en el libro y en la declaración por su **fecha
contable** —el día en que se registra—, no por la del proveedor. Una del 28 de
marzo registrada el 5 de abril se declara y se asienta en abril. La emitida
sigue yendo por su fecha de emisión.

---

## Los tres resúmenes del periodo

Ya existían. Todos de nivel `consulta`, con el mismo cuerpo: `ejercicio` y
`periodo`. No se guardan: se preguntan y contestan con lo que hay hoy.

### `/fiscal/iva`

`desde` y `hasta` del periodo, y dos listas —`repercutido` y `soportado`— con
un renglón por tipo: `tipo`, `base`, `cuota`, `recargo`. Más
`cuota_repercutida`, `cuota_soportada` y `resultado` (positivo, a ingresar;
negativo, a compensar o devolver).

Son bases y cuotas, **no casillas del 303**.

### `/fiscal/retenciones`

Un renglón por proveedor y porcentaje: `id_emisor`, `NIF_emisor`,
`NombreRazon_emisor`, `tipo`, `facturas`, `retenido`. Más `total_retenido` y un
`aviso` que dice que **no separa el modelo 111 del 115**. Ese aviso viene en la
respuesta a propósito y se enseña tal cual.

Aquí sí llega el NIF y el nombre del tercero.

### `/fiscal/cuadre_iva`

Seis cifras: repercutido y soportado, cada uno `en_facturas`, `contabilizado` y
`diferencia`. Más `cuadra`, `tolerancia` y `limites`, que explica hasta dónde
llega ese «cuadra» y qué casos no mira. `limites` se pinta junto al resultado,
no escondido.

---

## Lo que hay que resolver antes de escribir la pantalla

**Con el backend:**

1. **Los rótulos de las casillas y su orden.** Hoy solo llega el número. O lo
   manda la API, o habría que escribir aquí los treinta y tantos rótulos del
   impreso, que es contenido oficial del modelo y duplicarlo es pedir que un día
   digan cosas distintas.
2. **Identificar la factura en `avisos` y en `documentos`**: número de factura,
   fecha y nombre del tercero, como ya hace `/contabilizar/pendientes`.
3. **Ayuda de la pantalla**: no hay clave para fiscal ni para declaraciones.
4. **Descargas**: el 303 y los tres resúmenes no se pueden bajar. Conviene
   pedirlo después de ver la pantalla funcionando, sabiendo ya qué tiene que
   salir en el papel.

**Aquí:**

5. **¿Se pintan las casillas vacías?** Misma duda que los 200 epígrafes del
   balance. Antes hay que ver si la API manda las vacías o no las manda.
6. **¿Mensual o trimestral?** La API acepta las dos, pero nada dice cuál usa
   cada empresa. Lo más barato es recordar el último periodo elegido por
   usuario, como el filtro del diario y el de sumas y saldos.
7. **`documentos` viene de 200 en 200** y aquí no se pagina nada. Pedirlas en
   tandas hasta tenerlas todas, y avisar si se llega al tope de 5.000.
