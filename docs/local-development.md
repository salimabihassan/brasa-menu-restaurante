# BRASA con Supabase local

Este entorno usa PostgreSQL, Auth y Storage reales dentro de Docker. No necesita cuenta ni proyecto remoto de Supabase. Sus datos persisten en volúmenes Docker de `brasa-local`. No ejecutar `db reset` ni borrar los volúmenes si se quieren conservar los pedidos.

## Iniciar

1. Abrir Docker Desktop y esperar a que el motor esté listo.
2. Detener los contenedores de otros proyectos que no se estén usando (sin borrar volúmenes).
3. Ejecutar:

```sh
npm run db:start
npm run db:setup
npm run dev
```

La primera ejecución descarga imágenes y aplica `supabase/migrations/` y `supabase/seed.sql`. `db:setup` prepara la cuenta ficticia del personal y escribe únicamente la URL y clave pública locales en `.env.development.local`. La contraseña local generada queda en `.local/staff.json`; ambos archivos están fuera de Git. No usa ni modifica cuentas remotas.

Web: http://localhost:3000. Panel local de Supabase Studio: http://127.0.0.1:54323. API: http://127.0.0.1:54321. PostgreSQL: puerto 54322.

Entrar al panel del local con el correo `cocina@brasa.test` y la contraseña de `.local/staff.json`. Estos accesos son exclusivos para esta instalación de prueba.

## Verificar

```sh
npm test
npm run test:local
npm run typecheck
```

`npm test` verifica SQL y RLS en PostgreSQL embebido; `test:local` usa la API, Auth y Storage del Supabase local. Crea dos clientes temporales, archivos y pedidos de prueba y elimina únicamente esos datos al terminar. Genera un resumen en `.local/verification.json` si pasa. La prueba restaura la pausa y disponibilidad originales del local.

Prueba manual adicional: comprar en una ventana de navegador y gestionar el pedido en otra. Con la conexión local configurada, las sesiones consultan la misma base. La web obtiene actualizaciones cada 8 segundos y al recuperar el foco.

## Memoria y red

El arranque excluye Realtime, transformación de imágenes, Edge Runtime, analítica y pooler, que esta versión no necesita. Usa una red Docker propia con los puertos enlazados a 127.0.0.1. La base de datos y Studio no se exponen directamente al celular ni a internet; la prueba Wi-Fi usa el proxy web descrito abajo. Las variables locales solo se aplican al modo desarrollo de Next.js. La demo publicada conserva su configuración anterior y no puede conectarse a la base de este computador.

En Docker Desktop, `db:start` verifica las publicaciones de puertos y, si el motor ignora el límite de la red, recrea únicamente los contenedores de BRASA con una dirección explícita. Conserva sus volúmenes y archivos temporales de configuración; después renueva las conexiones a PostgreSQL. No modifica ni inicia proyectos ajenos.

El menú y los precios se consultan en `brasa_catalog` y `brasa_extras`. Los nombres y precios de cada compra quedan copiados en el pedido. Se conserva el orden visual del catálogo de demostración.

## Prueba desde el celular en la misma Wi-Fi

Para esta prueba se habilitó `NEXT_PUBLIC_SUPABASE_LOCAL_PROXY=true` y `BRASA_LAN_HOSTS=192.168.1.5` en `.env.development.local`. Reiniciar `npm run dev` cuando cambien esos valores. Abrir `http://192.168.1.5:3000` en el celular conectado a la misma Wi-Fi, y mantener el panel en `http://localhost:3000` en el computador.

Solo el servidor web escucha en la red; las rutas de desarrollo `/supabase/auth/v1`, `/supabase/rest/v1` y `/supabase/storage/v1` reenvían las operaciones al Supabase de localhost. PostgreSQL y Studio siguen limitados a 127.0.0.1. El proxy no se incluye en la compilación de producción. Si el router asigna otra IP al computador, actualizar `BRASA_LAN_HOSTS` y usar la nueva dirección. Esta prueba requiere mantener el computador encendido y `npm run dev` activo.

## Fotos del comprobante y datos del cliente

La web acepta fotos de hasta 30 MB y las optimiza en el navegador antes de subirlas. Mantiene la proporción, reduce dimensiones y calidad progresivamente y genera un JPG de menos de 900 KB, conservando el límite de 1 MB del bucket. Las fotos pequeñas JPG/PNG/WebP no se recomprimen. PDF permanece limitado a 1 MB; no se modifica su contenido. HEIC depende del decodificador del navegador: si no puede abrirlo, se pide JPG o una captura. Se muestra el progreso y el tamaño antes/después; no se puede enviar durante la optimización.

Tras una compra exitosa se recuerdan nombre y teléfono en este navegador si está marcada la opción correspondiente. El cliente puede desmarcarla para borrar el perfil recordado. Las observaciones no se guardan como perfil. Cada pedido mantiene sus propios datos de contacto en PostgreSQL.

## Alertas del panel

El sonido está activado por defecto. El control «Silenciar alertas» guarda la preferencia por sucursal y navegador, y la comparte entre pestañas del mismo origen. La alarma repite tres pares de tonos cada 2,4 segundos mientras el panel está abierto y quedan transferencias por revisar o pedidos pagados por aceptar. Al pulsar «Revisar transferencia» o abrir el comprobante se pausa únicamente ese pedido durante 60 segundos. Si no se resuelve el pago, vuelve a sonar. Aprobar la transferencia concede un minuto nuevo para iniciar preparación. Un contador muestra el tiempo restante. La pausa se conserva por fase de pedido en la sesión de esta pestaña; un pedido nuevo o comprobante reenviado no hereda otra pausa. Rechazar el comprobante, cancelar o aceptar el pedido lo retira de los pendientes de atención. Silenciar detiene inmediatamente los tonos programados. El volumen final depende del equipo.

El navegador puede bloquear el audio hasta una interacción. Entrar al panel, pulsar una tecla o hacer clic intenta habilitarlo; si sigue bloqueado, aparece «Habilitar audio». No funciona con la pestaña cerrada y puede interrumpirse si el navegador o el sistema suspende la aplicación.

«Mis pedidos» muestra por defecto las tarjetas pendientes, en preparación y listas para retirar. Al final, «Historial de pedidos» abre el historial de pedidos finalizados (entregados y cancelados). Ambas listas mantienen el orden del más nuevo al más antiguo. Al tocar una tarjeta se abre su detalle y seguimiento, con un botón para volver a la lista correspondiente.

## Detener al terminar

```sh
npm run db:stop
```

Detiene exclusivamente el proyecto `brasa-local` y conserva sus datos. No detiene ni borra proyectos ajenos. Docker Desktop puede continuar usando memoria de la máquina virtual; no se fuerza su cierre si otros trabajos lo requieren.

## Publicar más adelante

No publicar el build con una URL `127.0.0.1`/`localhost`. Para la futura conexión remota se creará otro proyecto, se aplicarán las migraciones, se configurarán los valores públicos remotos y se reconstruirá la web. Este trabajo local no sube la base ni los comprobantes a Supabase Cloud.

## Indicaciones por producto

Cada producto permite hasta 300 caracteres de instrucciones. Se guardan con el ítem del pedido, no como una observación global. Productos iguales con notas distintas se mantienen separados. El carrito, el detalle del cliente y el panel de cocina muestran la nota destacada como «Especial». La migración 202611130002_item_notes.sql actualiza la función de creación sin modificar pedidos existentes. `node --test tests/product-notes.integration.mjs` valida el guardado en una sucursal local aislada.

La impresión automática del ticket al pasar a preparación queda prevista para una etapa posterior. No se ha implementado ni se requiere una impresora para estas pruebas.

## Personalización por unidad

Los avisos al cliente y su prueba local están documentados en [customer-notifications.md](customer-notifications.md). Web Push permanece desactivado en el entorno LAN HTTP; el aviso dentro de la web funciona ahora.

La ventana del producto usa un único desplazamiento vertical, con cantidad y pestañas adheridas arriba y el botón de agregar adherido abajo. Los extras y las indicaciones no se comprimen en una franja interna. Al elegir varias unidades aparecen pestañas «Unidad 1», «Unidad 2», etc. Cada una tiene sus propios extras e indicaciones. «Aplicar a todas» copia la configuración seleccionada. Las unidades con configuraciones idénticas se agrupan; las distintas quedan separadas en el carrito y en cocina. El encabezado utiliza una miniatura. El tamaño se adapta al área visual disponible del navegador y el texto de las indicaciones usa 16 px para evitar el zoom automático en iOS.

## Tarjetas del panel del restaurante

En «En curso», los pedidos se muestran inicialmente desplegados, incluidos los nuevos que llegan durante la actualización. En «Todos» se muestran inicialmente replegados. El resumen incluye número, cliente, teléfono, hora de Chile, estado, total, cantidad, método de pago y aviso de indicaciones especiales. Al abrir una tarjeta aparecen productos, notas, comprobante y acciones. Cada tarjeta se abre de forma independiente y conserva su apertura durante las actualizaciones periódicas. Abrir el resumen no pausa la alarma: se mantiene el botón «Revisar transferencia» dentro del detalle.

## Menú editable y accesos separados

El cliente entra a `/`, cocina a `/local/` y administración del menú a `/admin/`. El cliente ya no tiene un botón al panel del personal. Ambos paneles utilizan la cuenta local existente. Ver [gestión del menú](menu-management.md) para carga de productos, categorías, extras, fotos y pruebas.

## Usuarios y permisos

La cuenta inicial ahora es administradora. `/admin/usuarios/` permite crear cuentas de administrador, menú y personal del local, editar niveles y desactivar accesos. `npm run users:start` inicia el servicio local de creación si no está activo; también se inicia con `npm run db:start`. Ver [usuarios y permisos](users-permissions.md).

## Cuenta para transferencias

Solo el administrador accede a `/admin/transferencias/`. El cliente ve la cuenta habilitada al elegir transferencia y puede copiar todos los datos, campos individuales y monto. Ver [datos de transferencia](bank-transfer-details.md).

## Avisos del restaurante en el teléfono

El panel `/local/` incluye la activación por dispositivo para administradores y personal del local. La cola y función Edge están probadas localmente; la activación y recepción con el teléfono bloqueado se probarán al publicar HTTPS. Ver [avisos del personal](staff-notifications.md).

## Delivery

La configuración está en `/admin/delivery/`. El cálculo por calles requiere `GOOGLE_MAPS_SERVER_API_KEY` en `.local/delivery.env` y reiniciar funciones con `npm run users:start -- --restart`. Ver [delivery](delivery.md). Sin clave puede configurarse la tarifa, pero se mantiene desactivado para clientes.
