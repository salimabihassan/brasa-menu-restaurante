# Menú editable y accesos del restaurante

## Entradas

- `/`: cliente, menú, carrito y seguimiento; no muestra accesos del personal.
- `/local/`: cocina, transferencias, estados y alarmas.
- `/admin/`: administración del menú y pausa del local.

Los dos paneles del personal requieren sesión y pertenencia a la sucursal. Comparten la cuenta local existente. Separar las direcciones no sustituye los permisos: las operaciones de menú y las subidas de fotos también verifican la sucursal en PostgreSQL/Storage. Ahora existen roles de administrador, encargado del menú y personal del local. Ver [usuarios y permisos](users-permissions.md).

## Uso

1. En «Categorías», crear los grupos del menú. Se pueden renombrar; sus productos se actualizan juntos. Solo se eliminan categorías vacías.
2. En «Extras», crear nombre y precio; se pueden editar y desactivar.
3. En «Productos», agregar o editar nombre, descripción, categoría, precio, foto y etiqueta opcional. Los importes son pesos chilenos enteros: `6.990` o `6990` representan $6.990; se rechazan decimales no nulos.
4. Marcar los extras que admite cada producto. Ya no dependen de que la categoría se llame Hamburguesas o Combos. Máximo 20 extras por producto.
5. «Disponible para comprar» permite marcar agotado. «Ocultar del menú del cliente» retira la tarjeta del menú sin borrar el historial.
6. Guardar. El cliente recibe los cambios al actualizar o en el siguiente ciclo de unos ocho segundos.

Las fotos se optimizan en el navegador y se suben al bucket público `brasa-menu`, separado de los comprobantes privados. Se aceptan hasta 30 MB en origen, almacenando como máximo 1 MB. Los productos guardan una ruta relativa `menu:sucursal/archivo`, que funciona en LAN y en el futuro servidor sin guardar la IP del computador en la foto. Usar imágenes con permiso de publicación. Si se sube una foto y luego se abandona la edición, puede quedar un archivo sin usar; no se elimina automáticamente una foto anterior porque podría estar referenciada por pedidos históricos.

Los pedidos guardan instantáneas de producto, precio, extras e indicaciones. Modificar el menú no altera pedidos existentes. El servidor comprueba precio, disponibilidad, ocultación y extras activos antes de aceptar una compra. Un carrito con precios anteriores debe revisarse y volver a armarse con el menú actualizado.

## Base y pruebas locales

Migraciones `202611140002_menu_management.sql` y `202611140003_menu_extra_lookup.sql`. El catálogo anterior se conserva y se transforma en editable. Aplicar todas las migraciones antes de ejecutar `seed.sql` en una base nueva. El seed completa datos que falten y no sobrescribe productos ya editados.

- `npm test`: incluye permisos de menú, categorías, validaciones y formato monetario, junto con las pruebas existentes.
- `npm run typecheck`: frontend y rutas.
- `node --test tests/menu-management.integration.mjs`: sucursal aislada con personal y cliente temporales; comprueba fotos, separación por sucursal, creación, edición, renombrado, extras inactivos, producto oculto/agotado y precios históricos intactos. Limpia los datos de prueba.

Se verificaron en el navegador los formularios de creación y edición de producto, categoría y extra; el producto de prueba se mantuvo oculto y luego fue retirado. La comprobación de foto y compra con extras se realizó además contra la API y Storage locales. Falta la revisión final del usuario con sus propias fotos y menú de muestra. No se publicó ni se conectó Supabase Cloud.
