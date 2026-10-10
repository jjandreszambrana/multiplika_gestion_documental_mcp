---
name: plan-cuentas-apartadas
description: /plan/listar acepta incluir_apartadas y devuelve oculta y estado; se decide por esos campos, nunca por origen. Pendiente de desplegar.
metadata:
  type: reference
---

Acordado con el backend el 27/08/2026, desplegado y **ya hecho en la pantalla
del plan**: casilla «Ver también las apartadas» (solo con nivel `cierre`), marca
«Oculta» o «Retirada» en la fila, y en su menú «Volver a mostrar…» o
«Reactivar…», que es lo único que se ofrece mientras esté apartada.

`/plan/listar` acepta `incluir_apartadas` (opcional, `false` por defecto) y cada
cuenta trae siempre dos enteros, no booleanos:

    oculta   1 = escondida en esta empresa, 0 = visible
    estado   1 = activa,                    0 = retirada

**Decidir qué botón se muestra por `oculta` y `estado`, NUNCA por `origen`:**
ocultar una cuenta del plan normativo crea por dentro una fila propia de la
empresa que tapa a la común, así que una cuenta común oculta llega con
`origen: "propia"` y `oculta: 1`.

Ocultar y retirar no son lo mismo: las del plan normativo se ocultan, y retirar
es para las propias de la empresa.

`/plan/obtener` devuelve también los dos campos pero sigue dando 404 con una
cuenta apartada. Si hiciera falta el detalle, se pide por
[[canal-con-backend]].

**Cómo aplicarlo:** `estaApartada` está en `src/api/plan.ts`. Los diálogos de
recuperar no piden el detalle de la cuenta, porque `/plan/obtener` da 404
mientras esté apartada. La copia del plan en memoria se sigue pidiendo sin
apartadas: de ahí salen los escalones al teclear una cuenta.
