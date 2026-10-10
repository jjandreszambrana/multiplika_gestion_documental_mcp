---
name: por-donde-va-el-frontend
description: Hecho el armazón, el plan contable y los terceros; lo siguiente es configuración contable y luego la fase de consulta en solo lectura.
metadata:
  type: project
---

Estado a 27/08/2026, al dejarlo para seguir desde el otro equipo (ver
[[entorno-dos-equipos]]):

Ese día se hicieron dos cosas: el arranque pasó a `/contabilidad/sesion/me`
(ver [[sesion-me-tipado]]) y el plan ya deja recuperar cuentas ocultas y
retiradas (ver [[plan-cuentas-apartadas]]). La casilla se llama «Ver también
las ocultas». Queda una duda de texto abierta: esa casilla y la marca de la
fila comparten la palabra «oculta», y una cuenta retirada aparece al marcarla.

Lo comunicado al backend en `1_para_backend.md`:

Hecho: armazón (login, `me`, empresas, conmutar, configuración, ejercicios,
cabecera con la empresa activa, menú por nivel), plan contable (árbol, alta de
subcuenta, mantenimiento según `origen`, punto como comodín) y terceros
(equivalencia subcuenta ↔ cliente/proveedor y asignación manual, dentro de
Enlace con gestión).

Siguiente: **pantalla de configuración contable** —cuentas por defecto,
`cuentas_sin_poner`, `avisos` y los modos `modo_cuenta_cliente` /
`modo_cuenta_proveedor`— y después la **fase de consulta en solo lectura**:
diario, mayor por cuenta, sumas y saldos, balance, pérdidas y ganancias, y
listado y detalle de asientos.

**Por qué:** el backend necesita saber qué partes de la API le hacen falta al
frontend primero, para priorizar.

**Cómo aplicarlo:** una pantalla por sesión. El detalle por fases está en
`docs/planificacion/PLAN.md`, que se actualiza al terminar cada fase. Ver
[[canal-con-backend]].
