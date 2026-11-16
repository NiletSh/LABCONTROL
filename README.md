# LAB CONTROL

Sistema administrativo para los dos laboratorios de informática de una institución educativa. Está pensado para usarse desde un teléfono y también desde una computadora.

Esta etapa entrega la estructura, la navegación y las pantallas de trabajo. Los datos que se ven son de demostración: no hay base de datos conectada y los cambios se pierden al recargar.

## Tecnologías

- Frontend: React, TypeScript y Vite.
- Navegación: React Router.
- Iconos: Lucide.
- Backend: Node.js, Express y TypeScript.
- Excel: ExcelJS, desde la API.
- Base de datos: esquema PostgreSQL en `database/schema.sql`. Todavía no está conectado.
- Aplicación instalable: manifiesto y service worker (PWA) en la compilación de producción.

## Cómo ejecutarlo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre [https://localhost:5173](https://localhost:5173). El desarrollo usa HTTPS para que el teléfono pueda activar la cámara.

- Interfaz: puerto 5173 (HTTPS)
- API: puerto 4000

La primera vez el navegador avisará que el certificado es local: en Chrome elige **Avanzado** → **Continuar**. En la computadora sigue siendo normal.

La vista inicial es la de **Administrador**, para poder recorrer todos los módulos. En el menú, “Ver como” cambia a **Encargado** y oculta los apartados que ese rol no opera. No hay contraseña: el acceso real se conectará con la base de datos.

### Teléfono (misma Wi‑Fi)

1. Deja `npm run dev` corriendo en la computadora.
2. En el teléfono abre `https://IP-DE-LA-PC:5173` (la IP aparece en la consola de Vite, línea Network).
3. Acepta el aviso del certificado.
4. En Escaneo, activa la cámara y apunta al QR.
5. Para instalarla: en Android, menú → **Agregar a la pantalla de inicio**; en iPhone (Safari), Compartir → **Añadir a pantalla de inicio**.

Para generar la versión instalable de producción:

```bash
npm run build
npm run dev:api
npm run preview -w frontend
```

La vista previa queda en [https://localhost:4173](https://localhost:4173) y también se puede abrir desde el teléfono por la IP de la red.

## Qué ya funciona

- Menú lateral en computadora y menú más barra inferior en teléfono.
- Dashboard con indicadores, gráfica de utilización, sesiones activas, incidencias y actividad del escenario.
- Formularios y tablas de alumnos, maestros, materias, sesiones, laboratorios, equipos, incidencias, reservaciones, estadísticas, reportes, bitácora y usuarios.
- En teléfono, los listados se muestran como tarjetas.
- Reglas de validación: matrícula única, horarios que no se cruzan y transiciones de sesión.
- Escaneo: la cámara lee el QR de la credencial y registra el ingreso en la sesión del laboratorio. Un segundo ingreso del mismo alumno en esa sesión se rechaza.
- Exportación a Excel de los registros filtrados, con una hoja que aclara que la fuente es de demostración.
- Los cambios válidos se ven en la pantalla y quedan marcados como “Sin guardar”. No se almacenan.

## Qué falta

- Conectar PostgreSQL usando `database/schema.sql` y guardar de forma permanente.
- Autenticación y permisos reales, en lugar del selector de demostración.
- Historial permanente de mantenimiento, bitácora y reportes oficiales.
