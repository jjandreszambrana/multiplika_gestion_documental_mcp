# Plan contable

Dos pantallas bajo el apartado `Plan contable` del menú: `Gestión plan contable`
y `Enlace con facturación`.

## Gestión plan contable

Título `Plan contable`. Buscador arriba: `Buscar por código o título`, con la
ayuda `El punto se rellena con ceros: 431.10 busca la 431000010`, y dos
casillas: `Solo subcuentas` y `Ver también las ocultas`.

Botones, según nivel: `Nuevo grupo o cuenta de mayor…` (nivel `cierre`) y
`Nueva subcuenta…` (nivel `apuntes`).

Columnas: Cuenta, Título, Tipo, Origen y las acciones.

- **La columna de la cuenta se dimensiona con el ancho de cuenta de la empresa**,
  no con un número fijo: con un ancho fijo se recortaban los últimos dígitos
  justo en las subcuentas, que es lo que se viene a mirar. El código va en
  monoespaciado, con sangría según el nivel, y no parte en dos líneas.
- **Tipo** es nomenclatura de pantalla, no una regla contable: las que admiten
  apuntes son subcuentas, y las demás se nombran por el nivel —un dígito, grupo;
  dos, subgrupo; de tres en adelante, cuenta de mayor. Quien decide qué admite
  apuntes es el plan, en `auxiliar`.
- **Origen** dice si la cuenta es del plan normativo (`comun`) o de la empresa
  (`propia`), y es lo que decide qué botones se muestran.

**El plan normativo no se toca.** Cada empresa crea sus cuentas encima, y cuando
el código coincide manda la suya.

Acciones sobre una cuenta, cada una con su confirmación: `Ocultar la cuenta`,
`Volver a mostrar la cuenta`, `Retirar la cuenta`, `Reactivar la cuenta` y
`Borrar la cuenta`. Cuál se ofrece **se decide por `oculta` y `estado`, nunca
por `origen`**: una cuenta común oculta llega como propia.

El plan entero se trae de fondo al entrar en la empresa y vive en memoria: de
ahí salen las sugerencias al teclear una cuenta en un asiento, sin esperar a
ninguna llamada. Se refresca al crear, cambiar o borrar una cuenta, y **al salir
del enlace con facturación**, porque desde allí se pueden dar de alta cuentas.

## Enlace con facturación

Título `Enlace con facturación`. Son las cuentas contables que atan la
facturación con la contabilidad.

Con dos pestañas cuando la empresa lleva los terceros en contabilidad:
`Fichas y cuentas` y `Cuentas de terceros externos`. Si los lleva en gestión,
solo la primera: la cuenta de un cliente vive en su ficha de facturación y se
mantiene allí, así que la lista de terceros externos no aporta nada.

**Los datos del tercero viven en gestión, no en contabilidad.** `razon` y `cif`
son los del momento del alta y no se refrescan, a propósito: un asiento antiguo
tiene que imprimirse con el nombre de entonces. No hay «sincronizar» y no hay
que inventarlo.
