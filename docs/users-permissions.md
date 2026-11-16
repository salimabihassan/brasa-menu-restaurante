# Usuarios y permisos

## Accesos

Para un restaurante pequeño basta una cuenta de administrador: puede realizar todas las tareas. Los otros niveles son opcionales. La propuesta de un encargado con menú y pedidos, pero sin gestión de usuarios, está anotada en [segunda versión](segunda-version.md) y todavía no modifica los permisos actuales.

- Cliente: `/`, sin enlaces del personal.
- Personal del local: `/local/`, pagos, comprobantes, estados y pedidos.
- Encargado del menú: `/admin/`, productos, fotos, categorías y extras.
- Administrador: todos los anteriores y `/admin/usuarios/`.

La cuenta local existente se conserva como administradora activa. Su correo y contraseña no cambian. La migración promueve las membresías que existían antes de incorporar los roles; las nuevas membresías tienen nivel `local` por defecto. En una base nueva, crear la primera cuenta administrativa desde la herramienta de preparación local o asignarla explícitamente desde un entorno de servidor autorizado.

## Pantalla de usuarios

El administrador crea cuentas con nombre, correo, contraseña y nivel. La contraseña requiere al menos 12 caracteres, letras y números. La cuenta queda confirmada, sin enviar invitación automática por correo. La contraseña se comunica de forma privada; no se guarda en localStorage ni en las tablas del negocio.

Se pueden editar nombre, nivel y estado activo. El correo queda fijo. No se implementaron restablecimiento de contraseña, edición de correo, invitaciones ni eliminación de cuentas desde la pantalla. Desactivar conserva historial y datos; revoca el acceso de personal a esa sucursal. No hay selector de sucursales todavía: se administra la sucursal configurada en la aplicación.

No se permite desactivar ni rebajar el nivel de la propia cuenta administrativa. Las operaciones se serializan por sucursal y deben conservar al menos un administrador activo. No se puede asignar un usuario de otra sucursal ni elevar permisos directamente desde el navegador. Límite inicial: 50 cuentas por sucursal.

## Aplicación de permisos

PostgreSQL valida rol y estado en cada operación protegida. El encargado del menú no lee pedidos ajenos, comprobantes privados ni la lista de usuarios. El personal del local no edita catálogo ni sube fotos de productos. Solo el administrador consulta usuarios y cambia permisos. Las cuentas inactivas pierden esos accesos aunque su JWT siga vigente. La interfaz refresca la membresía cada ocho segundos y al recuperar el foco, actualizando navegación y pantallas permitidas.

`manage-staff` es una Edge Function con validación explícita de JWT, origen y permiso de administrador. Crea Auth mediante clave administrativa exclusivamente en el servidor y llama `brasa_add_staff`, restringida a `service_role`, que vuelve a validar al solicitante y su sucursal. Si falla la asignación, intenta retirar la cuenta recién creada. No permite reutilizar desde la pantalla un correo ya registrado. Los cambios y desactivaciones usan `brasa_update_staff`, que verifica al administrador dentro de la base.

## Entorno local

La migración es `202611150001_staff_roles.sql`. `npm run users:start` inicia las funciones locales en la red privada `brasa-local`, usando la API que ya está vinculada a loopback. `npm run db:start` también las inicia automáticamente. El frontend usa la misma ruta `/supabase/functions/v1` mediante el proxy local. La configuración privada de funciones y sus registros quedan en `.local`, excluida de Git. El servicio adicional se necesita para crear usuarios; no se iniciaron proyectos ajenos.

Para el futuro despliegue, aplicar todas las migraciones, desplegar `manage-staff` y configurar `BRASA_ALLOWED_ORIGINS` con los orígenes HTTPS reales separados por comas. La función usa los secretos estándar de Supabase en servidor. No poner `service_role` en variables `NEXT_PUBLIC`. Todavía no se ha desplegado nada remoto.

## Pruebas

- `npm test`: RLS, permisos, bloqueo de elevación y protección de la cuenta administrativa.
- `npm run typecheck`: interfaz y rutas.
- `node --test tests/staff-roles.integration.mjs`: función local real, tres cuentas con niveles diferentes, credenciales de prueba aleatorias, rechazo por sucursal/origen, productos, fotos, pedidos, cambios de rol y revocación sin cerrar sesión. Limpia cuentas y sucursal temporales.

Prueba manual: crear un usuario del menú y otro del local, entrar desde ventanas privadas separadas y comprobar sus enlaces. Desactivar uno desde la cuenta administrativa; al actualizar deberá perder acceso. Reactivarlo si se desea conservarlo para otras pruebas.
