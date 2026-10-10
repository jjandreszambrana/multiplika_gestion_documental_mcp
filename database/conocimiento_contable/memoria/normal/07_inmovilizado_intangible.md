---
id: 31107
modelo: normal
numero: 7
titulo: "Inmovilizado intangible"
obligatorio: true
cuadros: [inmovilizado_intangible]
datos:
  - clave: movimiento_inmovilizado_intangible
    descripcion: "Movimiento por partida (salvo fondo de comercio): saldo inicial, entradas (generados internamente, por combinaciones de negocios y aportaciones no dinerarias), traspasos, salidas y saldo final, con amortización y deterioro"
    tipo: contabilidad
    formato: tabla
  - clave: garantias_restricciones
    descripcion: "Activos afectos a garantías y reversión y restricciones a la titularidad"
    tipo: gd
    formato: texto
  - clave: vidas_utiles_metodos
    descripcion: "Vidas útiles o coeficientes por clase y métodos de amortización, con amortización del ejercicio y acumulada de los elementos significativos"
    tipo: contabilidad
    formato: tabla
  - clave: cambios_estimacion
    descripcion: "Cambios significativos de estimación en valores residuales, vidas útiles o métodos"
    tipo: manual
    formato: texto
  - clave: adquirido_grupo_extranjero
    descripcion: "Intangibles adquiridos a empresas del grupo y asociadas, y los que se ejercitan o se relacionan con inversiones fuera de España"
    tipo: manual
    formato: tabla
  - clave: gastos_financieros_capitalizados
    descripcion: "Gastos financieros capitalizados en el ejercicio y criterio"
    tipo: contabilidad
    formato: numero
  - clave: deterioros_significativos
    descripcion: "Deterioros significativos reconocidos o revertidos: naturaleza, importe, causas, método e hipótesis"
    tipo: manual
    formato: texto
  - clave: no_afecto_explotacion
    descripcion: "Intangible no afecto directamente a la explotación"
    tipo: manual
    formato: tabla
  - clave: totalmente_amortizado
    descripcion: "Importe y características de los intangibles totalmente amortizados en uso"
    tipo: contabilidad
    formato: tabla
  - clave: subvenciones_relacionadas
    descripcion: "Subvenciones, donaciones y legados recibidos para intangibles e importe de los activos"
    tipo: gd
    formato: tabla
  - clave: compromisos_firmes
    descripcion: "Compromisos firmes de compra con su financiación previsible y compromisos firmes de venta"
    tipo: manual
    formato: texto
  - clave: resultado_enajenaciones
    descripcion: "Resultado del ejercicio por enajenación o disposición de intangibles"
    tipo: contabilidad
    formato: numero
  - clave: id_gasto_y_activacion
    descripcion: "Desembolsos de investigación y desarrollo llevados a gasto y justificación de la activación de los capitalizados"
    tipo: manual
    formato: texto
  - clave: vida_util_indeterminada
    descripcion: "Intangibles cuya vida útil no puede estimarse con fiabilidad: importe, naturaleza y causa"
    tipo: manual
    formato: texto
  - clave: otras_circunstancias
    descripcion: "Otras circunstancias sustantivas: arrendamientos, seguros, litigios, embargos y similares"
    tipo: gd
    formato: texto
  - clave: fondo_comercio
    descripcion: "Fondo de comercio: importe por combinación, conciliación del importe en libros (bruto, amortización, deterioro), factores que lo originan, UGE asignadas, vida útil, deterioros e hipótesis del importe recuperable"
    tipo: manual
    formato: tabla
fuentes: [BOE-A-2007-19884/A7-4]
---
# Inmovilizado intangible (modelo normal)

Misma estructura que el inmovilizado material, aplicada al subgrupo 20 (desarrollo, concesiones, patentes, fondo de comercio, derechos de traspaso, aplicaciones informáticas), con dos añadidos propios: la **investigación y desarrollo** y el **fondo de comercio**, que tiene un bloque aparte (7.2).

## Qué contar y en qué orden

**7.1 General** (todo menos el fondo de comercio):

1. **Cuadro de movimientos** del ejercicio y del anterior, por partida del balance, con amortización acumulada (cuenta 280) y deterioro (cuenta 290). Sale del SIF (`inmovilizado_intangible`). El modelo pide distinguir las altas generadas internamente (activaciones de desarrollo, cuenta 730) y las que vienen de combinaciones de negocios o aportaciones no dinerarias; el SIF no separa el origen, así que es dato manual salvo que se deduzca de la cuenta 730.
2. **Amortización**: métodos y vidas útiles por clase. Las aplicaciones informáticas suelen ir entre 3 y 5 años; el desarrollo, como máximo 5.
3. **I+D**: lo gastado en investigación y desarrollo que ha ido a resultados y por qué lo activado cumple las condiciones (proyecto individualizado, éxito técnico y rentabilidad razonables).
4. **Intangibles de vida útil indeterminada**, si los hay.
5. **Deterioros significativos**, garantías, restricciones, adquisiciones a empresas del grupo o en el extranjero, gastos financieros activados, bienes totalmente amortizados en uso, subvenciones, compromisos firmes y resultado de las ventas.

**7.2 Fondo de comercio**, solo si existe (cuenta 204):

6. Importe de cada combinación de negocios que lo originó, también las hechas entre el cierre y la formulación.
7. **Conciliación** del importe en libros al principio y al final: bruto, amortización practicada, deterioro, altas y bajas. El SIF da los saldos de las cuentas 204, 2804 y 2904; la asignación a cada combinación es manual.
8. Factores que explican el fondo de comercio, unidades generadoras de efectivo a las que se asigna, vida útil estimada y método de amortización.
9. Deterioros e hipótesis usadas para el importe recuperable.

## Cuándo se dice "no aplica"

Si la empresa no tiene intangibles, una frase. El bloque 7.2 se omite si no hay fondo de comercio. Lo normal es que casi todas las empresas tengan al menos aplicaciones informáticas.

## Errores frecuentes

- Activar gastos de investigación sin justificar las condiciones, o activar gastos de puesta en marcha, formación o publicidad, que nunca son intangible.
- Olvidar que desde 2016 el fondo de comercio se amortiza (10 años salvo prueba de otra vida útil): una conciliación sin columna de amortización está mal.
- No relacionar la activación de desarrollo con la limitación de dividendos de la nota 3.
- Incluir en intangible licencias de software por suscripción anual, que son gasto.

## Datos difíciles de conseguir

- **Justificación de la I+D activada**: memoria técnica del proyecto o informe motivado, si lo hay, en la GD; si no, preguntar.
- **Fondo de comercio**: la escritura de la combinación de negocios o la compraventa del negocio en la GD; las hipótesis del test de deterioro, solo la empresa.
- **Totalmente amortizados en uso**: igual que en el material, solo si el SIF lleva inventario por elemento.
