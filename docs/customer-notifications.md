# Avisos de pedido listo

## Prueba local con la web abierta

1. Actualizar la web del celular y el panel del computador.
2. Crear un pedido en el celular y mantener la web visible, con volumen multimedia audible.
3. En el panel, aprobar el pago si corresponde y pasar a preparación.
4. Pulsar «Listo para retirar».
5. Dentro de unos 8 segundos debe aparecer «¡Tu pedido está listo!», sonar una melodía y ofrecer «Ver mi pedido» y «Entendido».

El navegador necesita una interacción para habilitar audio. El aviso visual funciona aunque el audio esté bloqueado. No se puede garantizar sonido si el teléfono está silenciado, bloqueado o suspende el navegador. Cada evento se recuerda en este navegador para evitar repeticiones en cada actualización. No solicita permiso de notificaciones para este aviso dentro de la página.

## Push con la página cerrada

Implementado con permiso voluntario, un service worker sin caché, suscripciones privadas por cliente, cola transaccional al cambiar a listo y función `send-ready-notification`. El contenido enviado incluye solo el identificador del pedido; no transmite nombre, teléfono, comprobante ni productos. Cada dispositivo que aceptó el aviso pertenece a la sesión anónima de ese navegador. Borrar datos del navegador puede perder el acceso a pedidos previos.

Está desactivado por defecto. El acceso LAN HTTP del celular no sirve para activar Web Push. En iPhone se necesita una versión compatible y añadir la web a la pantalla de inicio. La entrega depende del navegador, sistema operativo, permisos y conectividad; no es una garantía ni un mensaje de WhatsApp.

### Activación futura en HTTPS

1. Aplicar todas las migraciones en el proyecto Supabase de destino, incluida `202611140001_ready_notifications.sql`. Mantener sesiones anónimas habilitadas.
2. Generar claves para ese entorno: `node scripts/setup-web-push.mjs --origin https://dominio-real.example --subject mailto:contacto-real@example.com`. Los archivos de `.local` están excluidos de Git. Guardar las claves de forma segura: regenerarlas invalida suscripciones anteriores.
3. Cargar `.local/push.env` como secretos de Edge Functions con `supabase secrets set --env-file .local/push.env --project-ref REFERENCIA`. La función también utiliza los secretos estándar que Supabase proporciona: URL, anon key y service role. Ninguna clave privada va en el frontend.
4. Desplegar `supabase functions deploy send-ready-notification --project-ref REFERENCIA`. La configuración desactiva el chequeo JWT de la pasarela porque el handler valida explícitamente el JWT y la pertenencia al local; las llamadas programadas requieren un token privado independiente.
5. Configurar en el entorno de compilación las dos variables de `.local/push-public.env`, junto con URL y clave pública del proyecto remoto. Reconstruir la web y publicarla en el origen HTTPS exacto de `BRASA_APP_ORIGIN`.
6. Activar un trabajador independiente: habilitar pg_cron, pg_net y Vault, guardar URL exacta de la función y token privado como secretos indicados en `supabase/push-cron.example.sql`, y ejecutar ese ejemplo una sola vez. El cron reintenta cada minuto aunque el panel esté cerrado. Sin este paso solo hay envío inmediato y reintentos mientras el panel permanezca abierto.
7. En el teléfono pulsar «Avisarme en el teléfono», aceptar, crear un pedido nuevo, cerrar la web y pasarlo a listo desde el panel. Comprobar también el enlace del aviso, dos clientes distintos, permiso denegado y suscripción vencida. No se ha probado todavía entrega real en un teléfono por HTTPS.

El envío usa leases de 60 segundos, hasta ocho intentos y registro por dispositivo. Elimina endpoints vencidos (404/410). Revisar trabajos `failed` con ocho intentos en `brasa_ready_push_jobs`; requieren investigación y reencolado operativo. En un fallo entre la recepción del proveedor y el registro en base puede repetirse un envío; el tag de la notificación reemplaza el aviso del mismo pedido.

## Comprobaciones

`npm test` verifica privacidad y permisos SQL, creación única de la cola, lease para envíos simultáneos, validación de destinos, cifrado del payload y deduplicación del aviso de la web. `npm run typecheck` valida el frontend. La parte push necesita además la prueba real de HTTPS descrita arriba antes de presentarse como operativa.

La ejecución local de la función se comprobó con `supabase functions serve send-ready-notification --network-id brasa-local --env-file .local/push.env` y `node --test tests/push-runtime.integration.mjs`: rechazo de peticiones sin sesión, de otro origen, cuerpos inválidos y clientes sin permiso de personal; procesamiento y deduplicación de un pedido sin suscripciones, en una sucursal aislada que se elimina al terminar. No se envían notificaciones a proveedores externos en esta prueba. Detener el servicio de funciones al terminar para liberar memoria.
