---
id: 31103
modelo: normal
numero: 3
titulo: "Aplicación de resultados"
obligatorio: true
cuadros: [desglose_balance, desglose_perdidas_y_ganancias]
datos:
  - clave: base_reparto
    descripcion: "Base de reparto: saldo de la cuenta de pérdidas y ganancias, remanente, reservas voluntarias y otras reservas de libre disposición"
    tipo: contabilidad
    formato: tabla
  - clave: propuesta_aplicacion
    descripcion: "Propuesta de aplicación: reserva legal, reservas especiales, voluntarias, dividendos, compensación de pérdidas y otros destinos"
    tipo: manual
    formato: tabla
  - clave: dividendos_a_cuenta
    descripcion: "Dividendos a cuenta repartidos en el ejercicio y estado contable previsional de liquidez que los justifica (un año desde el acuerdo)"
    tipo: gd
    formato: texto
  - clave: limitaciones_dividendos
    descripcion: "Limitaciones para repartir dividendos (reserva legal incompleta, pérdidas pendientes, gastos de desarrollo no amortizados, pactos de préstamos...)"
    tipo: manual
    formato: texto
fuentes: [BOE-A-2007-19884/A3-4]
---
# Aplicación de resultados (modelo normal)

Recoge la propuesta que el órgano de administración hace a la junta sobre qué hacer con el resultado del ejercicio. Es una propuesta: la decide la junta al aprobar las cuentas.

## Qué contar y en qué orden

1. **Cuadro de base de reparto**, con el formato del modelo: saldo de la cuenta de pérdidas y ganancias (cuenta 129), remanente (cuenta 120), reservas voluntarias (cuenta 113) y otras reservas de libre disposición, si se proponen usar. Total.
2. **Cuadro de aplicación**: a reserva legal (cuenta 112), a reservas especiales, a reservas voluntarias, a dividendos, a compensación de pérdidas de ejercicios anteriores (cuenta 121) y a otros destinos. El total tiene que ser igual al de la base de reparto.
3. **Dividendos a cuenta**, si se han repartido en el ejercicio: importe y el estado contable previsional que demostraba liquidez suficiente, que debe cubrir un año desde el acuerdo.
4. **Limitaciones para repartir dividendos**: reserva legal que no llega al 20 % del capital, pérdidas de años anteriores que dejan el patrimonio neto por debajo del capital, gastos de desarrollo pendientes de amortizar sin reservas que los cubran, o compromisos con bancos.

Las cifras de la base de reparto salen de la contabilidad (desglose del balance y de la cuenta de pérdidas y ganancias). La propuesta, no: la decide el órgano de administración.

## Cuándo se dice "no aplica"

La nota siempre existe, incluso con pérdidas: entonces la propuesta habitual es llevarlas a "Resultados negativos de ejercicios anteriores". Los puntos 3 y 4 solo si hay dividendos a cuenta o limitaciones; si no, una frase.

## Errores frecuentes

- Proponer dividendos sin dotar antes la reserva legal: en sociedades de capital, el 10 % del beneficio hasta que la reserva alcance el 20 % del capital.
- Repartir dividendos cuando, tras el reparto, el patrimonio neto quedaría por debajo del capital social.
- Que el total de la aplicación no cuadre con la base de reparto.
- Olvidar restar los dividendos a cuenta ya pagados (cuenta 557) del dividendo total propuesto.
- Usar el resultado antes de impuestos en lugar del resultado del ejercicio.

## Datos difíciles de conseguir

- La propuesta concreta: solo la conoce el órgano de administración. Si no hay respuesta, la IA puede proponer la aplicación mínima legal (reserva legal y compensación de pérdidas), marcándola como borrador.
- El estado previsional de liquidez de los dividendos a cuenta: buscar en la GD el acta del órgano de administración que acordó el reparto; suele llevarlo anexo.
- Los pactos de los préstamos que limitan dividendos: están en los contratos de financiación de la GD.
