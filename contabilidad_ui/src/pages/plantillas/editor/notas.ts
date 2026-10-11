/**
 * Las notas aclaratorias de las casillas del editor de plantillas, juntas
 * para revisarlas de una vez. Cada una dice qué se escribe ahí, con un
 * ejemplo.
 */
export const NOTA = {
  // Cabecera
  diario: 'Diario donde se apuntan los asientos. Cada asiento puede llevar otro en su pestaña.',
  comoSeGraba:
    'Como borrador: queda en «Sin confirmar» para revisarlo antes. Directamente en el libro: se apunta ya, con su número de asiento.',

  // Datos que pide
  clave: 'Nombre corto para usar el dato en las fórmulas. En minúsculas, sin espacios ni acentos: importe_bruto.',
  tipo: 'Qué se teclea: un importe, una fecha, una subcuenta, una tabla de filas…',
  rotulo: 'Lo que lee el contable encima de la casilla: «Importe bruto».',
  obligatorio: 'No deja grabar el asiento sin este dato.',
  defecto:
    "Lo que sale ya puesto. Es una fórmula: hoy(), fin_de_mes(hoy()), un texto entre comillas 'Alquiler' o un número: 21.",
  visibleSi: 'Cuándo se enseña la casilla. Vacío: siempre. Ejemplo: con_obra (solo si se marca ese dato).',
  validacion: 'Condición que tiene que cumplir para dejar grabar. Ejemplo: importe > 0.',
  mensajeValidacion: 'Lo que lee el contable si no se cumple: «Tiene que ser mayor que cero».',
  ayuda: 'Texto pequeño debajo de la casilla, como este.',
  largoMaximo: 'Número máximo de letras.',
  decimales: 'Cuántos decimales admite.',
  origenOpciones:
    'Escritas aquí: una lista cerrada que pones tú. Una lista de la empresa: sus obras, diarios o tipos de IVA, siempre al día.',
  valorOpcion: 'El valor que usan las fórmulas.',
  etiquetaOpcion: 'Lo que elige el contable en la lista.',
  filasMinimas: 'Cuántas filas hay que rellenar como poco.',
  filasMaximas: 'Cuántas filas se pueden rellenar como mucho.',
  columnas: 'Lo que se teclea en cada fila. En las líneas del asiento se usa como fila.columna: fila.bruto.',

  // Cálculos
  calculos:
    'Sirven para calcular una vez lo que usan varias líneas y llamarlo por su nombre: cuota = redondear(importe * 21 / 100). Cada cálculo puede usar los datos y los cálculos que tiene encima.',
  claveCalculo: 'Nombre del resultado, en minúsculas y sin espacios: cuota.',
  formula: 'Ejemplo: redondear(importe * 21 / 100).',

  // Asientos
  fechaAsiento: 'Fecha del asiento. Normalmente un dato de tipo fecha: fecha.',
  conceptoAsiento: "Texto del asiento. Ejemplo: 'Nómina ' + formato(fecha, 'MM/AAAA').",
  diarioAsiento: 'Vacío: el de la cabecera.',
  cuenta:
    "La subcuenta. Fija, entre comillas: '6400001'. Un dato de tipo subcuenta: gasto. La de un cliente o proveedor: cliente.cuenta.",
  importe:
    'Un dato, un cálculo o una fórmula: importe, cuota, fila.bruto. Vacío: cero. Si sale cero, la línea no se apunta.',
  conceptoLinea: 'Vacío: el del asiento.',
  documento: 'Número de factura u otro documento. Opcional.',
  obra: 'Obra a la que se imputa, normalmente un dato de tipo lista de obras. Vacío o 0: ninguna.',
  tipoIva: 'Solo en líneas de IVA, si hace falta para los libros. Opcional.',
  soloSi: 'Condición para que salga la línea. Vacío: sale siempre. Ejemplo: con_retencion.',
  repetirPor: 'Repite la línea por cada fila de una tabla. Dentro se usa fila.columna.',
} as const
