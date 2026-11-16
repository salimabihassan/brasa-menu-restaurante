# Avisos de nuevos pedidos al restaurante

## Estado de esta versión

Implementado y probado en local: cola de pedidos nuevos y comprobantes reenviados, suscripciones privadas del personal, permisos, revocación al cerrar sesión, trabajador de envío, navegación al pedido y sección de activación en `/local/`. Web Push sigue desactivado en el acceso LAN HTTP. No se probó todavía una entrega real de proveedor ni la recepción con el teléfono bloqueado.

La alarma insistente del panel abierto se mantiene. La notificación del sistema cuando el panel está cerrado no puede garantizar una alarma continua: sonido, vibración, silencio, ahorro de batería y presentación dependen del teléfono y del navegador. «Silenciar alertas» controla solo la alarma del panel; «Desactivar avisos del teléfono» controla su suscripción push.

## Eventos y destinatarios

- Un pedido nuevo crea un aviso al guardarse: tarjeta de prueba pagada o transferencia con comprobante privado ya subido. Carritos, pagos pendientes sin comprobante y filas incompletas no generan avisos.
- Reenviar un comprobante rechazado crea un nuevo evento. Un reintento de la misma compra o una transición de preparación no crea otro aviso de llegada.
- Cada usuario debe activar los avisos desde el teléfono correspondiente. Solo administradores y personal del local con membresía activa pueden suscribirse. El encargado del menú y los clientes no pueden activar avisos del restaurante.
- El servidor vuelve a verificar rol, sucursal y sesión al elegir destinatarios. Las suscripciones se vinculan a `auth.sessions`: al cerrar esa sesión se retiran automáticamente. Desactivar o cambiar el rol detiene los envíos posteriores aunque el JWT anterior siga vigente. Una notificación ya enviada puede permanecer en el teléfono; tocarla siempre exige la sesión y permisos actuales para leer el pedido.
- Al cerrar sesión desde la interfaz también se intenta retirar esa suscripción, conservando la suscripción del cliente si comparte navegador. Se cierra solo la sesión de ese dispositivo. Si no hay conexión no puede garantizarse la revocación inmediata en el servidor hasta que el cierre llegue a Auth; los avisos no incluyen información personal.
- Máximo 10 dispositivos por cuenta y 50 por sucursal. Las suscripciones de clientes y personal se almacenan por separado.

El payload contiene únicamente tipo de aviso, identificador del pedido y evento. No incluye nombre, teléfono, productos, comprobante, monto ni datos bancarios. El aviso muestra un número corto y abre `/local/?order=...`; no sustituye ni abre automáticamente una pestaña administrativa con cambios sin guardar. El panel selecciona la fecha y despliega la tarjeta del pedido.

## Envío y reintentos

`brasa_staff_push_jobs` es una cola transaccional por evento. `send-staff-notification` reclama cada trabajo con un lease de 60 segundos y registra resultados por dispositivo. Si el pedido ya no necesita atención o existe un evento posterior del mismo pedido, descarta el aviso antiguo. Endpoints vencidos (404/410) se eliminan. Los fallos se reintentan hasta ocho veces; los fallos finales requieren revisión operativa de la cola.

El tag reemplaza el aviso del mismo pedido y solicita volver a alertar cuando llega otro evento de ese pedido. El sistema operativo puede ignorar ese sonido. Existe una pequeña ventana de duplicación si el proveedor acepta el envío y se interrumpe el registro en base; no se promete entrega exactamente una vez.

Mientras el panel está abierto hay un reintento adicional cada 30 segundos, si push está configurado. El funcionamiento con todos los navegadores cerrados requiere activar el envío inmediato y el trabajador programado del servidor descritos a continuación; no depende del navegador del cliente para iniciar el envío.

## Activación al publicar en HTTPS

1. Aplicar todas las migraciones, incluidas `202611160003_staff_push.sql` y `202611160004_staff_push_guards.sql`.
2. Configurar las claves VAPID y `BRASA_PUSH_WORKER_TOKEN` con el procedimiento de [notificaciones del cliente](customer-notifications.md). Clientes y personal comparten la clave pública y el service worker, pero mantienen suscripciones separadas. Conservar las claves del entorno.
3. Desplegar `send-staff-notification` en Supabase y cargar los secretos del servidor: `BRASA_APP_ORIGIN`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`, `BRASA_PUSH_WORKER_TOKEN`, además de los secretos estándar de Supabase. El handler valida explícitamente JWT y pertenencia a la sucursal, o el token privado del trabajador. No poner claves privadas en `NEXT_PUBLIC`.
4. Compilar la web con `NEXT_PUBLIC_WEB_PUSH_ENABLED=true`, su clave pública VAPID y el proyecto remoto correcto, y publicarla en el origen HTTPS de `BRASA_APP_ORIGIN`.
5. En Vault configurar `brasa_staff_push_function_url` (URL exacta de la función desplegada) y `brasa_push_worker_token`. Ejecutar `supabase/staff-push-production.example.sql`: instala el aviso inmediato mediante pg_net después del commit del pedido y un cron independiente cada minuto para reintentos. El ejemplo admite URLs estándar de Supabase; revisar expresamente la validación si se usa un dominio propio. Vault debe estar habilitado. Este paso todavía no se ejecutó en un proyecto remoto.
6. Entrar a `/local/` desde cada teléfono, pulsar «Activar avisos en este teléfono» y aceptar el permiso. En iPhone/iPad compatible, agregar primero el panel a la pantalla de inicio y abrirlo desde ahí. `/local/` usa un manifiesto propio, «BRASA Local», para que el icono abra cocina en lugar del menú del cliente. Iniciar sesión desde ese icono y activar allí el permiso.

## Prueba pendiente con celular bloqueado

1. Activar los avisos del personal en el teléfono A y bloquearlo. Cerrar también el panel en la computadora para comprobar independencia del navegador.
2. Desde el teléfono B crear un pedido con comprobante de muestra. Verificar aviso de pedido nuevo en A; tocarlo, iniciar sesión si hace falta y comprobar tarjeta y estado actuales.
3. Rechazar el comprobante, bloquear A y reenviarlo desde B. Verificar «Nuevo comprobante».
4. Repetir con pago de tarjeta simulado, permiso denegado, dos teléfonos del equipo y reintentos sin duplicar la compra.
5. Cerrar sesión en A y comprobar que no recibe pedidos nuevos. Repetir desactivación de usuario y cambio al rol de menú desde otra sesión.
6. Confirmar que las notificaciones del cliente «Pedido listo» siguen abriendo el seguimiento, y que el aviso del restaurante abre cocina.

## Verificación local realizada

- `npm test`: pruebas existentes y service worker con destinos separados para cliente y restaurante.
- `npm run typecheck`: frontend y rutas.
- `node --test tests/staff-push.integration.mjs`: cuentas y sucursales aisladas, suscripción por sesión real, RLS, rol, dispositivo, límite de dispositivos, cola de compra idempotente, transferencia sin comprobante, reenvío, leases, evento superado y función Edge real sin destinatarios. No se enviaron mensajes a proveedores externos.
- Navegador: panel local con explicación de HTTPS y apertura de un pedido existente desde el enlace de notificación, sin cambiar el estado del pedido.

Para ejecutar la integración desde cero, generar primero las claves locales con `scripts/setup-web-push.mjs` (sin activar el flag público) e iniciar `npm run users:start`. Las funciones locales se sirven juntas; si se cambian secretos, reiniciar únicamente su servicio para cargar la nueva configuración.
