# BRASA · Pedidos con retiro

Prototipo de portafolio para Workana y Upwork. Una web responsive en español de Chile con precios CLP enteros. Marca, dirección y productos ficticios.

## Ejecutar

Node.js 20.9 o superior.

```sh
npm install
npm run dev
```

Abrir http://localhost:3000. `npm run build` genera la versión estática en `out/`. `npm run typecheck` comprueba TypeScript.

## Probar el recorrido

1. Agregar productos y extras al carrito.
2. Completar nombre y teléfono ficticios.
3. Adjuntar una imagen/PDF de muestra (máximo 1 MB) o elegir tarjeta simulada.
4. Abrir «Panel del local». Aprobar/rechazar comprobante, aceptar el pedido, marcar listo y entregado.
5. Volver a «Mi pedido» para consultar historial. Si el comprobante fue rechazado, adjuntar otro.
6. Activar sonido en el panel; los pendientes de revisión generan recordatorios cada 60 segundos mientras esté abierto.

## Límites de esta entrega

La persistencia usa localStorage de este navegador y origen. La sincronización entre pestañas funciona mediante eventos storage; no existe sincronización entre dispositivos ni backend. El panel está abierto intencionalmente para la demo, sin autenticación. No usar datos personales ni comprobantes reales. Los comprobantes quedan en el navegador, no en un almacenamiento privado remoto. Las imágenes de producto y fuentes requieren internet.

No hay cobros, transferencias, boletas ni notificaciones push reales. La tarjeta simula exclusivamente un resultado aprobado. Los recordatorios dependen del panel abierto y pueden retrasarse si el navegador suspende la pestaña.

## Siguiente integración

Conectar PostgreSQL, autenticación, archivos privados y Realtime en Supabase. Incorporar Prisma y migraciones, autorización por sucursal, validación de precios en servidor, idempotencia de pedidos y webhooks, pasarela de tarjeta en sandbox, pruebas de concurrencia y recuperación de pagos. No publicar como sistema comercial antes de completar estas integraciones.

`lib/catalog.ts` separa catálogo, sucursal, tipos e importes. Cada pedido contiene branchId y copia de nombres, precios y extras. La interfaz omite el selector mientras existe una sola sucursal. El modelo objetivo está en `docs/data-model.md`.

## GitHub

El repositorio incluye .gitignore para dependencias, builds y secretos. No se ha creado ni publicado un repositorio GitHub. No incluir archivos .env ni datos reales al subirlo.
