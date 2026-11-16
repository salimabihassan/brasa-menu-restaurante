# Revisión previa a publicación — BRASA

Fecha: 16 de noviembre de 2026. Alcance: demostración local; no certificación ni auditoría externa.

## Resultado

- Compilación de producción `npm run build`: correcta, incluidas las rutas administrativas y TypeScript. Se usa `.next-production` para separarla del servidor de desarrollo.
- 30 pruebas unitarias y de PostgreSQL aislado: correctas.
- 6 pruebas de integración local: correctas (roles, delivery, avisos del local, API/comprobantes, gestión de menú e indicaciones por producto).
- `npm audit --omit=dev`: 0 vulnerabilidades conocidas notificadas por el registro en esta revisión; no garantiza ausencia de vulnerabilidades.
- Archivos publicables escaneados: sin patrones de claves privadas ni coincidencias con las claves y contraseña locales comprobadas. `.local`, los archivos de entorno privados y los respaldos están ignorados por Git.
- Todas las tablas `public.brasa_*` tienen RLS activo. Funciones con privilegios elevados fijan search_path. Roles y pertenencia a sucursal se comprueban en la base, no solamente en la interfaz.
- Pruebas negativas: otro cliente no puede leer el pedido/comprobante, modificar pedidos directamente, aprobar pagos ni asignarse permisos. Desactivación y cambio de rol afectan también a JWT existentes.
- `brasa-receipts` es privado, con enlaces firmados de 120 segundos y límites de tamaño/tipo. `brasa-menu` es público intencionadamente para las fotos del menú. Un enlace firmado emitido antes de revocar permisos puede seguir vigente hasta que expire.
- Google Routes y credenciales privilegiadas se usan en funciones del servidor. El navegador recibe únicamente las claves públicas de Supabase/VAPID. Las funciones comprueban sesión/rol o token privado del trabajador, aunque verify_jwt esté desactivado en la puerta de entrada.
- Delivery: cotización asociada al cliente, con vencimiento, versión de tarifa, consumo único, límites por minuto y total calculado en servidor. CORS no sustituye estas comprobaciones.

## Respaldo privado y recuperación

Ejecutar `python scripts/backup-local.py` con Docker activo. Crea `.local/backups/<fecha UTC>/` con:

- `database.dump`: PostgreSQL en formato custom, incluye Auth, aplicación, metadatos de Storage y permisos. No incluye las definiciones de roles del clúster ni archivos físicos de PostgreSQL.
- `storage.tar.gz`: copia de los archivos del volumen Storage de BRASA.
- `source.zip`: fuentes actuales, incluidas modificaciones sin commit; sin dependencias, Git ni secretos.
- `private-config/`: configuración y claves locales necesarias para recuperar la prueba.
- `manifest.json`: tamaños y hashes SHA-256.

Es un respaldo PRIVADO: contiene datos personales, hashes de contraseñas y secretos. No publicarlo, adjuntarlo al portafolio ni importarlo indiscriminadamente al Supabase remoto. Mantener otra copia privada fuera de este equipo. Pausar pedidos y edición de archivos mientras se genera: PostgreSQL tiene snapshot consistente; Storage se copia por separado.

Ensayo aislado: crear una base vacía temporal en el PostgreSQL local de Supabase y restaurar usando su usuario interno `supabase_admin`, con `pg_restore --no-owner --exit-on-error`. Esto requiere los roles/extensiones que suministra Supabase. Ver `restore-verification.json` del respaldo para el resultado. No restaurar sobre la base activa sin una ventana de mantenimiento y un plan separado.

Para recuperación real local: instalar la misma versión del entorno Supabase, recuperar fuentes/configuración, detener consumidores de la base, restaurar en una base vacía y recuperar los archivos Storage en un volumen vacío correspondiente. Reaplicar o verificar permisos y propietarios, comprobar Auth, lectura privada de comprobantes, fotos y flujo de pedidos antes de habilitar compras. Los registros de notificaciones restaurados no deben enviar avisos históricos. El ensayo de esta revisión verifica restauración SQL y lectura íntegra del tar; no sustituye un ensayo completo de recuperación de toda la infraestructura y sesiones de navegador.

## Requisitos para publicar la demostración

1. Crear/configurar Supabase remoto y aplicar migraciones en orden; no copiar usuarios/clientes/comprobantes de pruebas por defecto. Crear administrador de producción por separado.
2. Usar URL/clave pública remota para compilar; desactivar el proxy local. La compilación de esta revisión valida código, no es el paquete final conectado al servidor remoto.
3. Guardar Google Routes, VAPID privada y token del trabajador en secretos de Edge Functions; fijar orígenes HTTPS exactos. Actualizar restricción de Google según la salida real del servidor; la IP doméstica solo sirve para local. Revisar cuotas y presupuesto en Google.
4. Habilitar acceso anónimo requerido por clientes, con protección contra abuso/CAPTCHA y límites de Auth apropiados para exposición pública. Los límites actuales por usuario pueden eludirse creando nuevas sesiones; vigilar también consumo global de Storage, usuarios y pedidos.
5. Desplegar funciones, configurar disparadores/cron de notificaciones y probar HTTPS con móvil bloqueado. No habilitar trabajadores contra copias restauradas de pedidos históricos.
6. Mantener avisos de demostración. Tarjeta es simulada y transferencias se revisan manualmente; no habilitar cobros reales sin pasarela y validación de sus webhooks.
7. Antes de uso comercial: términos/privacidad y revisión de retención/licencia de datos de Google Routes; recuperación completa, monitoreo y copias externas periódicas.

No se publicó ni se modificó un proyecto remoto durante esta revisión.
