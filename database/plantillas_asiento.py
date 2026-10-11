"""Lo que necesita la IA para montar una plantilla de asiento (asiento
predefinido) del SIF sin que el contable tenga que escribir fórmulas.

La forma de la plantilla y sus reglas las pone el SIF (apartado «17 sexies»
de su guía, y su ayuda `plantillas_de_asiento`). Aquí solo van el método de
trabajo y dos ejemplos completos, comprobados contra el motor del SIF: con un
ejemplo bueno delante, la IA acierta a la primera mucho más que con la
descripción sola.
"""

METODO = """\
Cómo montar una plantilla de asiento para el contable:

1. Entiende qué asiento quiere: qué datos teclea al usarla (fechas, importes,
   cuentas, filas de una tabla) y qué líneas salen. Si algo no está claro
   (una cuenta, si el IVA va aparte), pregúntalo antes de escribir nada.
2. Busca las subcuentas reales de la empresa con buscar_cuenta_contable_gd. En
   una fórmula, una subcuenta fija va entre comillas simples: "'6400001'".
3. Escribe la definición siguiendo los ejemplos. Todo campo de fórmula es
   texto; un texto literal va entre comillas simples. Las claves, en
   minúsculas y sin acentos, y sin usar nombres de funciones (texto, suma,
   mes, año...). Nunca calcules tú un importe: se escribe la fórmula.
4. Pruébala con probar_plantilla_asiento_gd y datos de ejemplo razonables.
   Si hay errores, cada uno trae su ruta (parametros[2].defecto,
   asientos[0].lineas[1].debe...): corrígelos y vuelve a probar.
5. Enseña al contable el asiento de la prueba (cuentas, debe y haber) y
   pregúntale si es lo que quería.
6. Con su visto bueno, guárdala con guardar_plantilla_asiento_gd. Queda
   retirada: el contable la revisa en Contabilidad › Diario › Asientos
   predefinidos y la pone en uso él. Díselo así.
"""

# Una nómina con varios empleados: una tabla, líneas repetidas por fila,
# totales con suma() y la línea de cuadre al banco.
EJEMPLO_NOMINA = {
    "diario": "GEN",
    "parametros": [
        {"clave": "fecha", "tipo": "fecha", "etiqueta": "Fecha de la nómina",
         "defecto": "fin_de_mes(hoy())", "obligatorio": True},
        {"clave": "banco", "tipo": "cuenta", "etiqueta": "Banco de pago",
         "filtro": "572*", "obligatorio": True},
        {"clave": "empleados", "tipo": "tabla", "etiqueta": "Empleados", "filas_minimas": 1,
         "columnas": [
             {"clave": "nombre", "tipo": "texto", "etiqueta": "Empleado", "obligatorio": True},
             {"clave": "bruto", "tipo": "importe", "etiqueta": "Bruto", "obligatorio": True},
             {"clave": "ss_empresa", "tipo": "importe", "etiqueta": "S. S. empresa"},
             {"clave": "ss_trabajador", "tipo": "importe", "etiqueta": "S. S. trabajador"},
             {"clave": "irpf", "tipo": "importe", "etiqueta": "IRPF"},
         ]},
    ],
    "variables": [
        {"clave": "total_ss", "expr": "suma(empleados, 'ss_empresa') + suma(empleados, 'ss_trabajador')"},
        {"clave": "total_irpf", "expr": "suma(empleados, 'irpf')"},
    ],
    "asientos": [{
        "fecha": "fecha",
        "concepto": "'Nóminas ' + formato(fecha, 'MM/AAAA')",
        "lineas": [
            {"cuenta": "'6400001'", "debe": "fila.bruto", "concepto": "'Sueldo ' + fila.nombre",
             "repetir_por": "empleados"},
            {"cuenta": "'6420001'", "debe": "fila.ss_empresa", "concepto": "'S. S. ' + fila.nombre",
             "repetir_por": "empleados"},
            {"cuenta": "'4760001'", "haber": "total_ss"},
            {"cuenta": "'4751001'", "haber": "total_irpf"},
        ],
    }],
    "opciones": {"autocuadre": {"cuenta": "banco", "concepto": "'Pago nóminas ' + formato(fecha, 'MM/AAAA')"},
                 "estado_inicial": "borrador"},
}

# Un gasto anual que se periodifica: la parte del mes y su reversión el día 1
# del mes siguiente. Datos sueltos, un cálculo y una línea que solo sale si
# se imputa a una obra.
EJEMPLO_PERIODIFICACION = {
    "diario": "GEN",
    "parametros": [
        {"clave": "fecha", "tipo": "fecha", "etiqueta": "Último día del mes",
         "defecto": "fin_de_mes(hoy())", "obligatorio": True},
        {"clave": "gasto", "tipo": "cuenta", "etiqueta": "Cuenta de gasto", "filtro": "62*", "obligatorio": True},
        {"clave": "anual", "tipo": "importe", "etiqueta": "Importe anual", "obligatorio": True,
         "validacion": "anual > 0", "mensaje_validacion": "Tiene que ser mayor que cero."},
        {"clave": "con_obra", "tipo": "booleano", "etiqueta": "Imputar a una obra"},
        {"clave": "obra", "tipo": "seleccion", "origen": "obras", "etiqueta": "Obra",
         "visible_si": "con_obra", "obligatorio": True},
    ],
    "variables": [{"clave": "cuota", "expr": "redondear(anual / 12)"}],
    "asientos": [{
        "fecha": "fecha",
        "concepto": "'Periodificación ' + formato(fecha, 'MM/AAAA')",
        "lineas": [
            {"cuenta": "gasto", "debe": "cuota", "id_obra": "obra if con_obra else 0"},
            {"cuenta": "'4800001'", "haber": "cuota"},
        ],
    }],
    "opciones": {"reversion": {"fecha": "sumar_dias(fin_de_mes(asiento_fecha), 1)",
                               "concepto": "'Reversión: ' + asiento_concepto"},
                 "estado_inicial": "borrador"},
}

EJEMPLOS = {
    "nomina_con_varios_empleados": EJEMPLO_NOMINA,
    "periodificacion_con_reversion": EJEMPLO_PERIODIFICACION,
}
