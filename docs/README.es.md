# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

Un potente userscript de gestión de transcripciones de YouTube con búsqueda difusa, traducción y resumen con IA, y superposición de subtítulos en tiempo real.

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Deutsch](README.de.md)** | **[日本語](README.ja.md)**

## Características

- **Extracción de transcripciones con un clic** — Obtén la transcripción de cualquier vídeo de YouTube con o sin marcas de tiempo
- **Búsqueda difusa** — Con [Fuse.js](https://www.fusejs.io/), busca en títulos, canales, etiquetas y contenido de transcripciones con tolerancia a errores tipográficos
- **Traducción con IA** — Traduce a 18 idiomas a través de [OpenRouter](https://openrouter.ai/) (cualquier modelo: Gemini, Claude, GPT, …). Las frases se mantienen completas y los subtítulos siguen sincronizados: el modelo agrupa los fragmentos de subtítulos en frases, y la temporización de cada grupo sale de los subtítulos originales — nunca del modelo
- **Fiable por diseño** — Salida estructurada (JSON) validada contra el original, reintentos automáticos con retroalimentación, espera progresiva ante límites de peticiones, cancelación en cualquier momento y reanudación tras un fallo sin pagar dos veces
- **Terminología coherente** — Una primera pasada crea un breve contexto del vídeo y un glosario que siguen todos los fragmentos
- **Resumen con IA** — Elige formato, tono, extensión e idioma de salida; los momentos clave incluyen marcas de tiempo en las que se puede hacer clic
- **Superposición de subtítulos** — Subtítulos con precisión de fotograma en el reproductor, modo bilingüe opcional (traducción + original), tamaño/color/fondo ajustables, y se apartan para no tapar los controles del reproductor
- **Exportación de subtítulos** — Descarga las traducciones en `.srt` o `.vtt`
- **Biblioteca de transcripciones** — Todo se guarda localmente en IndexedDB, con favoritos, etiquetas, búsqueda difusa y estadísticas
- **Visor** — Pestañas Original / Traducción / Resumen; haz clic en una marca de tiempo para saltar a ese punto, y la línea actual sigue la reproducción
- **Seguimiento de costos** — Costo exacto de cada traducción, informado directamente por OpenRouter
- **Privado** — Tu clave API se guarda en el almacenamiento del userscript (youtube.com no puede leerla); las peticiones van directamente a OpenRouter
- **Tema claro y oscuro**, diálogos y menús accesibles desde el teclado

## Instalación

### Desde un Release (Recomendado)

1. Instala [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
2. Descarga `subscribe.user.js` desde el [último release](https://github.com/umitaltintas/subscribe/releases/latest)
3. Abre el panel de Tampermonkey y arrastra el archivo — o crea un nuevo script y pega el contenido

### Desde el código fuente

```bash
bun install
bun run build
```

El userscript compilado estará en `dist/userscript.js`.

### Desarrollo

```bash
bun run watch      # Recompilar al detectar cambios
bun run typecheck  # Verificación de tipos TypeScript
bun test           # Pruebas unitarias (análisis, fragmentación, validación, flujo de traducción)
```

## Uso

Una vez instalado, verás nuevos botones en YouTube:

### Barra de navegación
- **Biblioteca** (logo de SubScribe) — Abre el panel con tu biblioteca de transcripciones
- **Configuración** (icono de engranaje) — Clave API (con botón «Probar»), modelo (con precios en tiempo real), idiomas, apariencia de los subtítulos

### Página del vídeo
- **Transcripción** — Extrae, etiqueta y guarda la transcripción del vídeo actual
- **Traducir** — Traduce y activa los subtítulos; muestra el progreso (haz clic para cancelar). Una vez guardada la traducción, el mismo botón activa o desactiva los subtítulos
- **Menú de idioma (▾)** — Cambia el idioma de destino, ve la traducción como texto, vuelve a traducir, ajustes de subtítulos
- **Resumir** — Genera un resumen; una vez guardado, lo abre

### Pestañas del panel

| Pestaña | Descripción |
|---------|-------------|
| Historial | Todas las transcripciones guardadas con búsqueda difusa y filtros |
| Favoritos | Transcripciones marcadas como favoritas |
| Traducciones | Ver y gestionar transcripciones traducidas |
| Estadísticas | Total de vídeos, tokens, palabras, canales y más |
| Datos | Acceso directo a la configuración, exportar/importar (incluye traducciones y resúmenes), reconstruir el índice de búsqueda |

### Configuración de traducción con IA

1. Consigue una clave API en [OpenRouter](https://openrouter.ai/)
2. Haz clic en el botón de configuración (engranaje) de la barra de YouTube
3. Introduce tu clave API y pulsa **Probar**; luego elige un modelo y el idioma de destino
4. Haz clic en **Traducir** en cualquier vídeo — los subtítulos aparecen en el reproductor en cuanto termina

## Tecnología

- **TypeScript** — Código completamente tipado
- **esbuild** — Empaquetado rápido en un único userscript IIFE
- **Fuse.js** — Motor de búsqueda difusa del lado del cliente
- **IndexedDB** — Almacenamiento local (sin servidor, sin cuentas)
- **OpenRouter API** — IA multimodelo con salidas estructuradas y seguimiento de costos
- **Trusted Types** — Manipulación DOM compatible con CSP

## Estructura del proyecto

```
src/
├── index.ts              # Punto de entrada, inicialización
├── config.ts             # Constantes y configuración
├── types.ts              # Definiciones de tipos TypeScript
├── db.ts                 # Envoltorio de IndexedDB (TranscriptDB)
├── transcript.ts         # Extracción de transcripciones del DOM de YouTube
├── search.ts             # Gestor de búsqueda con Fuse.js
├── ai.ts                 # Prompts y flujo de traducción y resumen
├── openrouter.ts         # Cliente de OpenRouter (reintentos, salida estructurada, costo)
├── http.ts               # Envoltorio de GM_xmlhttpRequest con cancelación
├── segments.ts           # Análisis puro de subtítulos, fragmentación, validación, SRT/VTT
├── translation-service.ts # Tareas, persistencia y subtítulos compartidos por toda la UI
├── settings-store.ts     # Configuración en el almacenamiento del userscript
├── subtitle-overlay.ts   # Visualización de subtítulos en tiempo real sobre el vídeo
├── router.ts             # Gestor de navegación de la SPA de YouTube
├── dom.ts                # Utilidades DOM e inyección de CSS
├── icons.ts              # Biblioteca de iconos SVG
├── utils.ts              # Funciones auxiliares
├── trusted-types.ts      # Política de Trusted Types
├── global.d.ts           # Declaraciones de tipos de la API de Tampermonkey
└── ui/
    ├── navbar.ts          # Botones de la cabecera y acciones de la página del vídeo
    ├── dashboard.ts       # Modal de la biblioteca
    ├── viewer.ts          # Visor de original / traducción / resumen
    ├── copy-modal.ts      # Modal para copiar y etiquetar
    ├── settings.ts        # Modal de configuración
    ├── summary-options.ts # Diálogo de opciones de resumen
    ├── modal.ts           # Modal accesible + diálogo de confirmación
    ├── menu.ts            # Menú desplegable
    └── require-key.ts     # Comprobación de la clave API
tests/                     # Suites de bun test
```

## Contribuir

Las contribuciones son bienvenidas. No dudes en abrir un issue o enviar un pull request.

## Licencia

[MIT](../LICENSE)
