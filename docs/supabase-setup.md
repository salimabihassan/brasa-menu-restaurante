# Conectar un proyecto nuevo de Supabase

La cuenta existente de Supabase sirve. BRASA usa un proyecto independiente: no ejecutar estos scripts sobre otro negocio.

## 1. Crear el proyecto

En https://supabase.com/dashboard elegir **New project**, nombre `brasa-demo`, organización propia y región próxima a Chile si está disponible. El propietario elige y conserva la contraseña de la base de datos. Esperar a que termine la creación.

## 2. Crear las tablas y datos de prueba

En SQL Editor ejecutar, en este orden y una sola vez:

1. `supabase/migrations/202611130001_brasa.sql`.
2. `supabase/migrations/202611130002_item_notes.sql`.
3. `supabase/migrations/202611140001_ready_notifications.sql`.
4. `supabase/migrations/202611140002_menu_management.sql`.
5. `supabase/migrations/202611140003_menu_extra_lookup.sql`.
6. `supabase/migrations/202611150001_staff_roles.sql`.
7. `supabase/migrations/202611150002_product_availability.sql`.
8. `supabase/migrations/202611160001_bank_details.sql`.
9. `supabase/migrations/202611160002_bank_validation.sql`.
10. `supabase/migrations/202611160003_staff_push.sql`.
11. `supabase/migrations/202611160004_staff_push_guards.sql`.
12. `supabase/migrations/202611160005_delivery.sql`.
13. `supabase/seed.sql`.

La migración crea tablas, funciones PostgreSQL, políticas RLS y un bucket privado de comprobantes con límite de 1 MB. La aplicación estática llama funciones RPC: precios, permisos, idempotencia, historial y transiciones se validan en PostgreSQL. No usa service_role ni requiere un servidor Next.js para esta demo. Prisma se pospone: no debe mantener migraciones paralelas de estas mismas tablas.

## 3. Activar clientes sin registro

En Authentication habilitar **Anonymous Sign-Ins**. El cliente recibe una identidad temporal de Supabase sin crear una cuenta visible. Solo puede leer sus pedidos y sus archivos. Borrar los datos del navegador elimina el acceso a sus pedidos anteriores; todavía no se ofrece seguimiento por enlace compartible.

Antes de compartir una demo con una audiencia amplia, configurar protección contra abuso/CAPTCHA y cuotas; esta entrega no incluye un widget CAPTCHA. Limitar la audiencia al piloto privado mientras se completa esa protección.

## 4. Dar acceso al personal

Crear un usuario de correo y contraseña desde Authentication → Users, con correo confirmado. La contraseña de este usuario la elige el propietario; no se comparte en el chat. Copiar únicamente su UUID y ejecutar:

```sql
insert into public.brasa_memberships(user_id,branch_id,role,active,display_name)
values ('UUID_DEL_USUARIO', 'santiago-centro','admin',true,'Administrador');
```

La cuenta de Supabase Dashboard y la cuenta del personal de BRASA son accesos distintos. Los clientes no pueden darse permisos de personal. Una membresía autoriza solo su sucursal. La sesión del personal y la sesión temporal del cliente se guardan por separado.

## 5. Configurar la web

Copiar `.env.example` a `.env.local` y completar la Project URL y la clave **publishable** (o anon pública) del proyecto. Nunca poner una clave secret/service_role. Ejecutar `npm run build` después de configurarlas.

Los valores NEXT_PUBLIC se incorporan al compilar. En la publicación estática de Sites, configurarlos solo como variables de ejecución NO modifica el bundle ya generado: hay que reconstruir y publicar los assets con esos valores. `.env.local` se excluye de Git; la clave pública sí es visible en el bundle por diseño, y la seguridad depende de las políticas RLS.

Si faltan ambos valores, continúa el modo local. Si están configurados y Supabase falla, el sistema muestra un error y no guarda el pedido localmente fingiendo una sincronización exitosa.

## 6. Prueba entre dispositivos

1. Abrir la demo en el celular y enviar un comprobante ficticio.
2. Abrir el panel del local en el computador e iniciar sesión con el usuario de personal.
3. El pedido debe aparecer en hasta 8 segundos. Aprobar el pago y avanzar hasta entregado.
4. Confirmar que el celular muestra los mismos cambios al actualizarse.
5. Repetir rechazando el comprobante y enviando otro desde el celular.
6. Comprobar que otro navegador cliente no puede leer el pedido y que una cuenta sin membresía no abre el panel.

La actualización remota usa consultas cada 8 segundos y al recuperar foco; aún no requiere activar Realtime. Los recordatorios de revisión siguen cada 60 segundos con el panel abierto. Los enlaces de archivos privados vencen a los 120 segundos y pueden renovarse desde el panel.

## Estado de validación

`npm test` ejecuta la migración y los datos en PostgreSQL embebido (PGlite), con roles y políticas RLS. Verifica aislamiento de clientes y sucursales, permisos de archivos, precios manipulados, idempotencia, revisión, reenvío y transiciones con control de versión. No sustituye la prueba remota de Auth y Storage en Supabase, pendiente hasta crear el proyecto.

## Pendientes para uso comercial

Pasarela real y webhooks, protección contra abuso, limpieza de archivos huérfanos por intentos fallidos, retención de datos y respaldo, seguimiento recuperable fuera del navegador original y gestión de roles. La tarjeta actual es exclusivamente una simulación autorizada por el campo demo_payments de la sucursal; no registra un cobro real.

## Administración del menú

El cliente usa `/`, cocina `/local/` y administración `/admin/`. Los paneles del personal requieren la cuenta de la sucursal. El bucket público `brasa-menu` contiene fotos de productos; `brasa-receipts` sigue siendo privado. Ver [menú editable](menu-management.md).

## Usuarios del equipo

Configurar y desplegar `manage-staff` antes de crear cuentas desde la web. Ver [usuarios y permisos](users-permissions.md). La cuenta inicial debe tener rol `admin`; los usuarios siguientes se crean desde `/admin/usuarios/`.

## Cuenta de transferencia

El administrador configura `/admin/transferencias/` y habilita los datos que verá el cliente al pagar. Ver [datos de transferencia](bank-transfer-details.md). No se incluye una cuenta bancaria real en el repositorio.

## Avisos al restaurante

Ver [avisos del personal](staff-notifications.md): desplegar `send-staff-notification`, configurar HTTPS/VAPID y activar `supabase/staff-push-production.example.sql` para envío inmediato y reintentos independientes del panel abierto. La entrega con el teléfono bloqueado se verifica después de publicar.

## Delivery

Ver [delivery por calles](delivery.md). Desplegar `quote-delivery` con clave privada propia de Google Routes y configurar tarifas desde `/admin/delivery/`. No se incluye una clave ni se habilita delivery automáticamente.
