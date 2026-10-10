---
id: 31207
modelo: abreviado
numero: 7
titulo: "Fondos propios"
obligatorio: false
cuadros: [desglose_balance]
datos:
  - clave: capital_autorizado
    descripcion: "Sociedades anónimas: capital autorizado por la junta para que lo emitan los administradores y periodo de la autorización"
    tipo: gd
    formato: texto
  - clave: acciones_suscritas_capital_autorizado
    descripcion: "Número y nominal de las acciones suscritas en el ejercicio dentro del capital autorizado"
    tipo: gd
    formato: tabla
  - clave: acciones_propias
    descripcion: "Acciones o participaciones propias en poder de la sociedad o de un tercero por su cuenta: número, valor nominal, precio medio de adquisición y destino previsto"
    tipo: contabilidad
    formato: tabla
  - clave: adquisiciones_enajenaciones_propias
    descripcion: "Importe de las adquisiciones y enajenaciones de acciones o participaciones propias y de la sociedad dominante en el ejercicio"
    tipo: contabilidad
    formato: tabla
fuentes: [BOE-A-2007-19884/contenidodelamemoriaabreviada, BOE-A-2010-10544/a260, BOE-A-2010-10544/a261]
---
# Fondos propios (modelo abreviado)

Nota corta que el modelo abreviado limita a dos supuestos: el **capital autorizado** en las sociedades anónimas y la **autocartera** (acciones o participaciones propias). El art. 261 de la Ley de Sociedades de Capital añade la indicación quinta del art. 260: acciones suscritas dentro del capital autorizado y adquisiciones y enajenaciones de acciones propias o de la dominante.

## Qué contar y en qué orden

1. **Capital autorizado** (solo sociedades anónimas): importe que la junta ha autorizado a los administradores a emitir sin nuevo acuerdo, y hasta cuándo dura la autorización. Si en el ejercicio se han emitido acciones con cargo a ella, su número y valor nominal.
2. **Autocartera**: número, valor nominal y precio medio de adquisición de las acciones o participaciones propias que tiene la sociedad (cuenta 108) o un tercero por su cuenta, y qué piensa hacer con ellas (amortizarlas reduciendo capital, venderlas, entregarlas a trabajadores).
3. **Movimientos de autocartera del año**: importe comprado y vendido de acciones propias y de acciones de la sociedad dominante (cuenta 109 si se trata de acciones de la dominante).

Aunque el modelo no lo exige, suele ser útil para el lector un párrafo breve con el capital social (número de participaciones, valor nominal, si está totalmente desembolsado) y la situación de la reserva legal. Si se añade, que sea breve y salga del `desglose_balance` (subgrupo 10 y cuentas 112, 113...).

## Cuándo se dice "no aplica"

En la mayoría de sociedades limitadas sin autocartera la nota no tiene contenido obligatorio y puede omitirse, o incluir solo el párrafo informativo del capital. Por eso no es obligatoria.

## Errores frecuentes

- En una SL, mantener participaciones propias más tiempo del permitido: deben amortizarse o venderse en un plazo máximo de tres años desde la adquisición (art. 141 de la Ley de Sociedades de Capital). Si pasa, conviene advertirlo al contable.
- Presentar la autocartera en el activo en lugar de restarla del patrimonio neto.
- No dotar la reserva indisponible cuando la sociedad tiene acciones de su dominante.
- Confundir capital autorizado (facultad de emitir) con capital suscrito pendiente de desembolso.

## Datos difíciles de conseguir

- **Acuerdos de junta** que autorizan capital o la compra de acciones propias: actas en la GD.
- **Libro registro de acciones nominativas o de socios**: para el número y nominal de la autocartera; GD.
- **Precio medio de adquisición**: se calcula con los asientos de la cuenta 108 si se registraron por compra, pero el número de títulos solo está en el libro registro o en la escritura.
