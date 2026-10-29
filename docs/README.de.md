# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

Ein leistungsstarkes YouTube-Transkript-Manager-Userscript mit unscharfer Suche, KI-gestützter Übersetzung & Zusammenfassung und Echtzeit-Untertitel-Overlay.

**[English](../README.md)** | **[Turkce](README.tr.md)** | **[Espanol](README.es.md)** | **[日本語](README.ja.md)**

## Funktionen

- **Ein-Klick-Transkript-Extraktion** — Transkript jedes YouTube-Videos mit oder ohne Zeitstempel abrufen
- **Unscharfe Suche** — Mit [Fuse.js](https://www.fusejs.io/) über Titel, Kanäle, Tags und Transkriptinhalte mit Tippfehlertoleranz suchen
- **KI-Übersetzung** — Übersetzung in 18 Sprachen über [OpenRouter](https://openrouter.ai/) (beliebiges Modell: Gemini, Claude, GPT, …). Sätze bleiben vollständig und die Untertitel trotzdem synchron: Das Modell fasst Untertitel-Fragmente zu Sätzen zusammen, das Timing jeder Gruppe stammt aber immer aus den Original-Untertiteln — nie vom Modell
- **Zuverlässig by Design** — Strukturierte (JSON-)Ausgabe, die gegen die Quelle validiert wird, automatische Wiederholungen mit Feedback, Backoff bei Rate-Limits, jederzeit abbrechbar und nach Fehlern fortsetzbar, ohne doppelt zu bezahlen
- **Einheitliche Terminologie** — Ein erster Durchlauf erstellt einen kurzen Videokontext und ein Glossar, an das sich jeder Abschnitt hält
- **KI-Zusammenfassung** — Format, Tonfall, Länge und Ausgabesprache wählen; wichtige Momente erhalten anklickbare Zeitstempel
- **Untertitel-Overlay** — Framegenaue Untertitel im Player, optionaler zweisprachiger Modus (Übersetzung + Original), einstellbare Größe/Farbe/Hintergrund, weicht den Player-Steuerelementen aus
- **Untertitel-Export** — Übersetzungen als `.srt` oder `.vtt` herunterladen
- **Transkript-Bibliothek** — Alles wird lokal in IndexedDB gespeichert, mit Favoriten, Tags, unscharfer Suche und Statistiken
- **Viewer** — Tabs für Original / Übersetzung / Zusammenfassung; Klick auf einen Zeitstempel springt zur Stelle, die aktuelle Zeile folgt der Wiedergabe
- **Kostenverfolgung** — Exakte Kosten pro Übersetzung, direkt von OpenRouter gemeldet
- **Privat** — Ihr API-Schlüssel liegt im Userscript-Speicher (für youtube.com nicht lesbar); Anfragen gehen direkt an OpenRouter
- **Helles & dunkles Design**, per Tastatur bedienbare Dialoge und Menüs

## Installation

### Vom Release (Empfohlen)

1. [Tampermonkey](https://www.tampermonkey.net/) installieren (Chrome, Firefox, Edge, Safari)
2. `subscribe.user.js` vom [letzten Release](https://github.com/umitaltintas/subscribe/releases/latest) herunterladen
3. Tampermonkey-Dashboard öffnen und die Datei hineinziehen — oder ein neues Skript erstellen und den Inhalt einfügen

### Aus dem Quellcode

```bash
bun install
bun run build
```

Das erstellte Userscript befindet sich unter `dist/userscript.js`.

### Entwicklung

```bash
bun run watch      # Bei Dateiänderungen neu erstellen
bun run typecheck  # TypeScript-Typprüfung ausführen
bun test           # Unit-Tests (Parsing, Chunking, Validierung, Übersetzungsablauf)
```

## Verwendung

Nach der Installation erscheinen neue Schaltflächen auf YouTube:

### Navigationsleiste
- **Bibliothek** (SubScribe-Logo) — Öffnet das Dashboard mit Ihrer Transkript-Bibliothek
- **Einstellungen** (Zahnradsymbol) — API-Schlüssel (mit „Testen“-Schaltfläche), Modell (mit aktuellen Preisangaben), Sprachen, Untertitel-Darstellung

### Videoseite
- **Transkript** — Transkript des aktuellen Videos extrahieren, taggen und speichern
- **Übersetzen** — Übersetzt und schaltet die Untertitel ein; zeigt den Fortschritt an (Klick bricht ab). Nach dem Speichern schaltet dieselbe Schaltfläche die Untertitel ein und aus
- **Sprachmenü (▾)** — Zielsprache wechseln, Übersetzung als Text anzeigen, neu übersetzen, Untertitel-Einstellungen
- **Zusammenfassen** — Erstellt eine Zusammenfassung; nach dem Speichern wird sie geöffnet

### Dashboard-Tabs

| Tab | Beschreibung |
|-----|--------------|
| Verlauf | Alle gespeicherten Transkripte mit unscharfer Suche und Filtern |
| Favoriten | Als Favorit markierte Transkripte |
| Übersetzungen | Übersetzte Transkripte anzeigen und verwalten |
| Statistiken | Gesamtzahl der Videos, Tokens, Wörter, Kanäle und mehr |
| Daten | Verknüpfung zu den Einstellungen, Export/Import (inkl. Übersetzungen & Zusammenfassungen), Suchindex neu aufbauen |

### KI-Übersetzung einrichten

1. Einen API-Schlüssel von [OpenRouter](https://openrouter.ai/) besorgen
2. Auf die Einstellungen (Zahnrad) in der YouTube-Navigationsleiste klicken
3. API-Schlüssel eingeben und auf **Testen** klicken, dann Modell und Zielsprache wählen
4. Bei einem beliebigen Video auf **Übersetzen** klicken — sobald die Übersetzung fertig ist, erscheinen die Untertitel im Player

## Technologie

- **TypeScript** — Vollständig typisierte Codebasis
- **esbuild** — Schnelles Bundling in ein einzelnes IIFE-Userscript
- **Fuse.js** — Clientseitige unscharfe Suchmaschine
- **IndexedDB** — Lokaler Speicher (kein Server, keine Konten)
- **OpenRouter API** — Multi-Modell-KI mit strukturierten Ausgaben und Kostenverfolgung
- **Trusted Types** — CSP-kompatible DOM-Manipulation

## Projektstruktur

```
src/
├── index.ts              # Einstiegspunkt, Initialisierung
├── config.ts             # Konstanten und Konfiguration
├── types.ts              # TypeScript-Typdefinitionen
├── db.ts                 # IndexedDB-Wrapper (TranscriptDB)
├── transcript.ts         # Transkript-Extraktion aus dem YouTube-DOM
├── search.ts             # Fuse.js-Suchmanager
├── ai.ts                 # Prompts und Pipeline für Übersetzung & Zusammenfassung
├── openrouter.ts         # OpenRouter-Client (Wiederholungen, strukturierte Ausgabe, Kosten)
├── http.ts               # GM_xmlhttpRequest-Wrapper mit Abbruchfunktion
├── segments.ts           # Reines Untertitel-Parsing, Chunking, Validierung, SRT/VTT
├── translation-service.ts # Jobs, Persistenz und Untertitel für die gesamte UI
├── settings-store.ts     # Einstellungen im Userscript-Speicher
├── subtitle-overlay.ts   # Echtzeit-Untertitelanzeige auf dem Video
├── router.ts             # Navigations-Handler für die YouTube-SPA
├── dom.ts                # DOM-Hilfsfunktionen und CSS-Injektion
├── icons.ts              # SVG-Icon-Bibliothek
├── utils.ts              # Hilfsfunktionen
├── trusted-types.ts      # Trusted-Types-Richtlinie
├── global.d.ts           # Typdeklarationen für die Tampermonkey-API
└── ui/
    ├── navbar.ts          # Masthead-Schaltflächen und Aktionen auf der Videoseite
    ├── dashboard.ts       # Bibliotheks-Modal
    ├── viewer.ts          # Viewer für Original / Übersetzung / Zusammenfassung
    ├── copy-modal.ts      # Modal zum Kopieren & Taggen
    ├── settings.ts        # Einstellungs-Modal
    ├── summary-options.ts # Dialog für Zusammenfassungsoptionen
    ├── modal.ts           # Barrierefreies Modal + Bestätigungsdialog
    ├── menu.ts            # Dropdown-Menü
    └── require-key.ts     # Prüfung auf API-Schlüssel
tests/                     # bun-test-Suites
```

## Mitwirken

Beiträge sind willkommen! Erstellen Sie gerne ein Issue oder senden Sie einen Pull Request.

## Lizenz

[MIT](../LICENSE)
