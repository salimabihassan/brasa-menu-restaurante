# Delivery por calles

## Implementado en local

El administrador configura `/admin/delivery/`: dirección completa de salida, precio por kilómetro en CLP y alcance máximo en kilómetros de recorrido. Solo administradores activos pueden modificarlo. Se pueden guardar tarifas desactivadas sin clave de Google; activar delivery desde la pantalla requiere que el servidor informe una clave configurada.

El cliente elige retiro o delivery en el pago. Para delivery escribe calle, número, comuna e indicaciones opcionales, y pulsa «Calcular delivery». Se consulta Google Routes Compute Routes con dirección de origen y destino, `DRIVE`, `TRAFFIC_UNAWARE`, sin alternativas y pidiendo solamente `routes.distanceMeters,routes.duration`. No se envían nombre, teléfono, productos, cuenta bancaria ni comprobante a Google. No se usa la ubicación GPS del celular.

La cobertura se mide por calles; no representa un radio geométrico. El costo es `round(metros / 1000 × precio_por_km)`, redondeado únicamente al peso final. El límite incluye exactamente la distancia máxima y rechaza cualquier distancia superior. El retiro no cobra delivery. No hay tarifa base, mínimo, envío gratis, asignación automática de repartidores ni seguimiento GPS en esta entrega.

## Validación del pedido

El cálculo se realiza en una Edge Function, con clave privada de servidor. Un RPC restringido a servidor crea una cotización de cinco minutos ligada al cliente, sucursal, dirección y versión de tarifa. El navegador no puede crear cotizaciones ni decidir su distancia o costo. Cada pulsación de calcular consulta al proveedor; no se reutilizan rutas guardadas como caché de consultas posteriores.

`brasa_place_order` valida la cotización, su vencimiento, propietario, sucursal y versión de configuración; calcula productos con los precios actuales de PostgreSQL, añade el envío y exige coincidencia del total. Una cotización solo puede usarse para una compra. Reintentar el mismo identificador devuelve el pedido existente, incluso si después expiró la cotización. Cambiar dirección invalida el cálculo en pantalla y cambiar tarifas invalida cotizaciones pendientes. Al vencer, se debe calcular y comprobar el total antes de pagar. El pago sigue siendo de demostración, sin dinero real.

El pedido conserva dirección de entrega, indicaciones, tarifa y costo del envío con los que se aceptó. Cambios posteriores no alteran el pedido. La dirección no se agrega al perfil guardado en localStorage; solo figura en el pedido privado del cliente y en el panel del personal autorizado.

Estados para domicilio: por aceptar → preparación → listo para despacho → en reparto → entregado. El aviso al cliente se genera al salir a reparto, con «Tu pedido va en camino»; no se le pide retirar un envío a domicilio. El retiro mantiene sus estados y aviso original. Transferencias y avisos de nuevos pedidos siguen funcionando.

## Pendiente: clave de Google y prueba de ruta real

No hay una clave de Google Routes configurada para BRASA. No se copió ninguna clave de Accesorios Méndez ni se hicieron llamadas facturables para las pruebas. La opción de delivery permanece desactivada para los clientes hasta configurar esta conexión.

1. En un proyecto de Google Cloud autorizado para BRASA, habilitar facturación y Routes API, y crear una clave privada restringida a esa API y al servidor según el despliegue. Configurar cuotas acordes al piloto.
2. Crear `.local/delivery.env` a partir de `.local/delivery.env.example`, con `GOOGLE_MAPS_SERVER_API_KEY=...`. Ambos están fuera de Git. Nunca usar `NEXT_PUBLIC` para esa clave.
3. Ejecutar `npm run users:start -- --restart` para recargar únicamente las funciones de BRASA; la base y los pedidos se conservan. Al desplegar, cargar la misma variable como secreto de `quote-delivery` en Supabase.
4. Abrir el panel de delivery, guardar origen real autorizado y tarifa, y activar. El indicador confirma presencia de clave, no que Google la haya autorizado: comprobar una ruta real después.
5. Antes de activar públicamente, revisar atribución, privacidad, términos y las restricciones de almacenamiento aplicables al contenido de Google Routes. La interfaz identifica sus resultados con «Google Maps». No se incluyen mapas ni proveedores de mapas alternativos.
6. Probar una dirección dentro del alcance y otra fuera. Comprobar subtotal, envío, total de transferencia y dirección del pedido. No usar dinero real en esta demostración.

El endpoint limita consultas por minuto en PostgreSQL: seis por cliente y treinta por sucursal. Ese límite se comprueba antes de llamar a Google. Los errores de clave, cobertura, tiempo de espera o respuesta incompleta impiden calcular; no se inventa una distancia ni se ofrece una ruta en línea recta como reemplazo.

Las cotizaciones son registros de checkout con caducidad; antes de uso público debe definirse la retención y limpieza de datos de proveedor conforme a la licencia aplicable. No se deben usar para reconstruir una base de rutas.

## Pruebas

- `npm test`: cálculo, límite inclusivo, redondeo, validación de respuesta de Google y avisos según retiro/delivery.
- `npm run typecheck`: interfaz y rutas.
- `node --test tests/delivery.integration.mjs`: sucursal y cuentas temporales, roles, cotización de servidor con metros de prueba, manipulación de total, propiedad, caducidad, reutilización, cambio de tarifas, transferencia con envío incluido y estados. No consume Google; las rutas reales quedan pendientes.
- Navegador: sección de configuración muestra correctamente la falta de clave y no permite activar por error.

## Fuentes oficiales

- [Compute Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions).
- [Selección de campos](https://developers.google.com/maps/documentation/routes/choose_fields).
- [Políticas y atribución](https://developers.google.com/maps/documentation/routes/policies).

## Otros ajustes de esta entrega

Se agregó mostrar/ocultar contraseña en el acceso del personal y en la creación de usuarios. Los formularios con contraseña usan POST como respaldo si todavía no se cargó JavaScript. Se verificó la visibilidad del campo sin enviar credenciales ni crear cuentas de prueba desde la pantalla.
