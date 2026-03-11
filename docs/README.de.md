# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

Ein leistungsstarkes YouTube-Transkript-Manager-Userscript mit unscharfer Suche, KI-gestutzter Ubersetzung und Echtzeit-Untertitel-Overlay.

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Espanol](README.es.md)** | **[日本語](README.ja.md)**

## Funktionen

- **Ein-Klick-Transkript-Extraktion** — Transkript jedes YouTube-Videos mit oder ohne Zeitstempel abrufen
- **Unscharfe Suche** — Mit [Fuse.js](https://www.fusejs.io/) uber Titel, Kanale, Tags und Transkriptinhalte mit Tippfehlertoleranz suchen
- **KI-Ubersetzung** — Transkripte in uber 10 Sprachen uber [OpenRouter](https://openrouter.ai/) ubersetzen (unterstutzt alle Modelle: Gemini, Claude, GPT usw.)
- **Untertitel-Overlay** — Ubersetzte Untertitel direkt im YouTube-Videoplayer in Echtzeit anzeigen
- **Transkript-Bibliothek** — Alle Transkripte werden lokal in IndexedDB gespeichert: Favoriten, Tags, Statistiken
- **Dashboard** — Verwaltungsoberflache mit Verlauf, Favoriten, Ubersetzungen, Statistiken und Datenexport/-import
- **Kostenverfolgung** — Token-Nutzung und Kosten pro Ubersetzung uber die OpenRouter API einsehen

## Installation

### Vom Release (Empfohlen)

1. [Tampermonkey](https://www.tampermonkey.net/) installieren (Chrome, Firefox, Edge, Safari)
2. `subscribe.user.js` vom [letzten Release](https://github.com/umitaltintas/subscribe/releases/latest) herunterladen
3. Tampermonkey-Dashboard offnen und die Datei hineinziehen — oder ein neues Skript erstellen und den Inhalt einfugen

### Aus dem Quellcode

```bash
bun install
bun run build
```

Das erstellte Userscript befindet sich unter `dist/userscript.js`.

### Entwicklung

```bash
bun run watch      # Bei Dateiandererungen neu erstellen
bun run typecheck  # TypeScript-Typprufung ausfuhren
```

## Verwendung

Nach der Installation erscheinen neue Schaltflachen auf YouTube:

### Navigationsleiste
- **Transkript-Manager** (Dokumentsymbol) — Offnet das Dashboard mit der Transkript-Bibliothek
- **Einstellungen** (Zahnradsymbol) — KI-Ubersetzungseinstellungen konfigurieren

### Videoseite
- **Transkript**-Schaltflache — Transkript des aktuellen Videos extrahieren und speichern
- **Ubersetzen**-Schaltflache — Transkript ubersetzen und Untertitel auf dem Video anzeigen

### Dashboard-Tabs

| Tab | Beschreibung |
|-----|--------------|
| Verlauf | Alle gespeicherten Transkripte mit unscharfer Suche und Filtern |
| Favoriten | Als Favorit markierte Transkripte |
| Ubersetzungen | Ubersetzte Transkripte anzeigen und verwalten |
| Statistiken | Gesamtzahl der Videos, Tokens, Worter, Kanale und mehr |
| Einstellungen | Datenexport/-import, Suchindex neu aufbauen |

### KI-Ubersetzung einrichten

1. Einen API-Schlussel von [OpenRouter](https://openrouter.ai/) erhalten
2. Auf die Einstellungen (Zahnrad) in der YouTube-Navigationsleiste klicken
3. API-Schlussel eingeben, Modell und Zielsprache auswahlen
4. Auf einem beliebigen Video "Ubersetzen" klicken — Untertitel erscheinen im Player

## Technologie

- **TypeScript** — Vollstandig typisierte Codebasis
- **esbuild** — Schnelles Bundling in ein einzelnes IIFE-Userscript
- **Fuse.js** — Clientseitige unscharfe Suchmaschine
- **IndexedDB** — Lokaler Speicher (kein Server, keine Konten)
- **OpenRouter API** — Multi-Modell-KI-Ubersetzung mit Kostenverfolgung
- **Trusted Types** — CSP-kompatible DOM-Manipulation

## Mitwirken

Beitrage sind willkommen! Erstellen Sie gerne ein Issue oder senden Sie einen Pull Request.

## Lizenz

[MIT](../LICENSE)
