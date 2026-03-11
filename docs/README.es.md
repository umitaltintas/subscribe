# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

Un potente userscript de gestion de transcripciones de YouTube con busqueda difusa, traduccion con IA y superposicion de subtitulos en tiempo real.

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Deutsch](README.de.md)** | **[日本語](README.ja.md)**

## Caracteristicas

- **Extraccion de transcripciones con un clic** — Obten la transcripcion de cualquier video de YouTube con o sin marcas de tiempo
- **Busqueda difusa** — Con [Fuse.js](https://www.fusejs.io/), busca en titulos, canales, etiquetas y contenido de transcripciones con tolerancia a errores tipograficos
- **Traduccion con IA** — Traduce transcripciones a mas de 10 idiomas a traves de [OpenRouter](https://openrouter.ai/) (soporta cualquier modelo: Gemini, Claude, GPT, etc.)
- **Superposicion de subtitulos** — Muestra subtitulos traducidos directamente en el reproductor de YouTube en tiempo real
- **Biblioteca de transcripciones** — Todas las transcripciones se almacenan localmente en IndexedDB con favoritos, etiquetas y estadisticas
- **Panel de control** — Interfaz completa con historial, favoritos, traducciones, estadisticas y exportacion/importacion de datos
- **Seguimiento de costos** — Consulta el uso de tokens y costo por traduccion a traves de la API de OpenRouter

## Instalacion

### Desde un Release (Recomendado)

1. Instala [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
2. Descarga `subscribe.user.js` desde el [ultimo release](https://github.com/umitaltintas/subscribe/releases/latest)
3. Abre el panel de Tampermonkey y arrastra el archivo — o crea un nuevo script y pega el contenido

### Desde el codigo fuente

```bash
bun install
bun run build
```

El userscript compilado estara en `dist/userscript.js`.

### Desarrollo

```bash
bun run watch      # Recompilar al detectar cambios
bun run typecheck  # Verificacion de tipos TypeScript
```

## Uso

Una vez instalado, veras nuevos botones en YouTube:

### Barra de navegacion
- **Gestor de transcripciones** (icono de documento) — Abre el panel con tu biblioteca de transcripciones
- **Configuracion** (icono de engranaje) — Configura los ajustes de traduccion con IA

### Pagina del video
- **Transcripcion** — Extrae y guarda la transcripcion del video actual
- **Traducir** — Traduce la transcripcion y muestra subtitulos sobre el video

### Pestanas del panel

| Pestana | Descripcion |
|---------|-------------|
| Historial | Todas las transcripciones guardadas con busqueda difusa y filtros |
| Favoritos | Transcripciones marcadas como favoritas |
| Traducciones | Ver y gestionar transcripciones traducidas |
| Estadisticas | Total de videos, tokens, palabras, canales y mas |
| Configuracion | Exportar/importar datos, reconstruir indice de busqueda |

### Configuracion de traduccion con IA

1. Obtener una clave API de [OpenRouter](https://openrouter.ai/)
2. Hacer clic en el boton de configuracion (engranaje) en la barra de YouTube
3. Ingresar la clave API, seleccionar un modelo y el idioma destino
4. Hacer clic en "Traducir" en cualquier video — los subtitulos apareceran en el reproductor

## Tecnologia

- **TypeScript** — Codigo completamente tipado
- **esbuild** — Empaquetado rapido en un unico userscript IIFE
- **Fuse.js** — Motor de busqueda difusa del lado del cliente
- **IndexedDB** — Almacenamiento local (sin servidor, sin cuentas)
- **OpenRouter API** — Traduccion con IA multimodelo con seguimiento de costos
- **Trusted Types** — Manipulacion DOM compatible con CSP

## Contribuir

Las contribuciones son bienvenidas. No dudes en abrir un issue o enviar un pull request.

## Licencia

[MIT](../LICENSE)
