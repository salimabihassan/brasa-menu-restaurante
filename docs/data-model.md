# Modelo objetivo para PostgreSQL

La versión de demostración funciona sin credenciales. Este documento describe las entidades de la futura integración; no implica una base remota creada.

Todas las tablas operativas usan UUID y fechas UTC; los horarios se interpretan en America/Santiago. Importes CLP enteros no negativos.

| Entidad | Relaciones y restricciones |
| --- | --- |
| Branch | Nombre, dirección, zona horaria, activa, pedidos pausados, cuenta receptora |
| BranchHours / ScheduleException | FK sucursal; horarios semanales y excepciones por fecha |
| StaffProfile / BranchMembership | FK identidad de Auth; roles y membresía única usuario–sucursal |
| Category / Product | Producto pertenece a categoría; borrado lógico |
| BranchProduct | FK sucursal y producto; par único; precio y disponibilidad |
| ModifierGroup / ModifierOption | Mínimo y máximo de selección; opciones por grupo |
| ProductModifierGroup | Relación de productos con grupos permitidos |
| BranchModifierOption | Par sucursal–opción único; precio y disponibilidad |
| BankAccount | Instrucciones de transferencia, compartibles entre sucursales |
| Order | FK sucursal; cliente, teléfono, total, moneda, estado, token de seguimiento hasheado y clave de idempotencia única |
| OrderItem / OrderItemModifier | FK pedido/ítem; cantidades positivas; copia del nombre y precio comprado |
| PaymentAttempt | FK pedido; método, importe, estado, identificador del proveedor único |
| TransferReceipt | FK intento; ruta privada, fecha y revisión con actor y motivo |
| PaymentEvent | Identificador de evento único para deduplicar webhooks |
| OrderStatusHistory / AuditLog | Actor, fecha, transición y motivo; historial inmutable |

El servidor crea el pedido y sus ítems en una transacción. La bandeja del restaurante solo consulta pedidos con pago confirmado o comprobante enviado. Un comprobante pendiente de revisión no vence por demora del local. Rechazarlo permite un nuevo intento sin duplicar el pedido. Preparación requiere pago confirmado. Cancelar tras pago exige registrar una devolución pendiente.

Antes de exponer datos: permisos por sucursal en servidor y RLS para accesos de navegador, almacenamiento privado, validación de archivos, límites de frecuencia y tokens de seguimiento no predecibles. Las actualizaciones de estado comparan el estado previo para controlar concurrencia.
