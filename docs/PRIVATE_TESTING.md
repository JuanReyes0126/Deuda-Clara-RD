# Entorno privado de testing

Esta fase de pruebas ya no usa túneles públicos temporales ni links que expiran.

La solución elegida es un entorno **local, privado y persistente**:

- escucha solo en `127.0.0.1`
- no queda expuesto a Internet
- mantiene logs locales
- puede quedarse corriendo en segundo plano
- funciona bien con `DEMO_MODE_ENABLED=true` aunque PostgreSQL falle

## Instalación mínima

```bash
npm install
cp .env.example .env
```

Para pruebas locales sin depender de PostgreSQL, deja esto en tu `.env`:

```bash
DEMO_MODE_ENABLED=true
APP_HOST=127.0.0.1
APP_PORT=3000
APP_URL=http://127.0.0.1:3000
```

## Modo más simple para probar bugs

Usa este comando cuando quieras hot reload, logs en consola y detener con `Ctrl + C`:

```bash
npm run dev
```

Ese modo:

1. levanta la app solo en `127.0.0.1`
2. no genera links públicos
3. deja los logs visibles en consola
4. usa `DEMO_MODE_ENABLED=true` por defecto si no lo definiste en el entorno

## Modo recomendado para pruebas largas y estables

Levanta una build privada en segundo plano:

```bash
npm run private:up
```

Eso hace dos cosas:

1. compila la app
2. la deja corriendo en `http://127.0.0.1:3000`
3. guarda PID y logs en `.runtime/`

## Comandos disponibles

Ver estado:

```bash
npm run private:status
```

Ver logs:

```bash
npm run private:logs
```

Reiniciar con una build nueva:

```bash
npm run private:restart
```

Detener:

```bash
npm run private:stop
```

## Acceso

URL privada local:

```bash
http://127.0.0.1:3000
```

Credenciales demo:

- `demo@deudaclarard.com`
- `DeudaClara123!`

## Logs y archivos de runtime

Los archivos del entorno privado viven en:

```bash
.runtime/
```

Archivos principales:

- `.runtime/private-app.pid`
- `.runtime/private-app.json`
- `.runtime/private-app.log`

## Variables útiles

Host y puerto por defecto:

- `APP_HOST=127.0.0.1`
- `APP_PORT=3000`
- `APP_URL=http://127.0.0.1:3000`

Si no defines `DEMO_MODE_ENABLED`, el runner privado lo deja en `true` por defecto para que puedas seguir probando aunque la base esté caída.

Si en algún momento quieres probar dentro de tu red local, puedes cambiar temporalmente:

```bash
APP_HOST=0.0.0.0 APP_PORT=3000 npm run private:restart
```

Eso ya no es público por Internet, pero sí queda accesible desde otros equipos de tu misma red. No lo uses si quieres mantenerlo solo en tu máquina.

## Recomendación de testing

Para sesiones largas de QA:

1. `npm run private:up`
2. `npm run private:status`
3. `npm run private:logs` cuando necesites revisar errores

Para desarrollo activo:

1. `npm run dev`
2. usa `npm run private:up` cuando quieras validar comportamiento tipo producción sin dejar la terminal ocupada

## Cómo detener la app

Modo desarrollo:

```bash
Ctrl + C
```

Modo privado en segundo plano:

```bash
npm run private:stop
```

## Problemas comunes

### El puerto 3000 está ocupado

Verás un mensaje claro al arrancar. Soluciones:

```bash
APP_PORT=3001 npm run dev
```

o:

```bash
APP_PORT=3001 npm run private:up
```

### PostgreSQL está caída

La app no debe romper si `DEMO_MODE_ENABLED=true`. En ese caso:

- login/signup usan fallback demo
- deudas/pagos/simulador usan datos demo persistidos localmente
- puedes seguir probando navegación y bugs sin DB

### Quiero ver logs del modo privado

```bash
npm run private:logs
```
