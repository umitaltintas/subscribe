# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

YouTube transkript yoneticisi — fuzzy arama, yapay zeka destekli ceviri & ozetleme ve gercek zamanli altyazi ozellikleriyle.

**[English](../README.md)** | **[Deutsch](README.de.md)** | **[Espanol](README.es.md)** | **[日本語](README.ja.md)**

## Ozellikler

- **Tek Tikla Transkript Cikarma** — Herhangi bir YouTube videosunun transkriptini zaman damgali veya damgasiz olarak alin
- **Fuzzy Arama** — [Fuse.js](https://www.fusejs.io/) ile baslik, kanal, etiket ve transkript icinde yazim hatalarini tolere eden arama
- **Yapay Zeka Cevirisi** — [OpenRouter](https://openrouter.ai/) uzerinden 10'dan fazla dile ceviri (Gemini, Claude, GPT vb. tum modeller desteklenir)
- **Yapay Zeka Ozetleme** — Tek tikla video ozetleri: ana konu, onemli noktalar ve sonuclar
- **Altyazi Kaplama** — Cevrilen altyazilari YouTube video oynaticisinda gercek zamanli goruntuleyin
- **Transkript Kutuphanesi** — Tum transkriptler IndexedDB'de yerel olarak saklanir: favoriler, etiketler, istatistikler
- **Yonetim Paneli** — Gecmis, favoriler, ceviriler, istatistikler ve veri disa/ice aktarma
- **Maliyet Takibi** — OpenRouter API uzerinden ceviri basina token kullanimi ve maliyet bilgisi

## Kurulum

### Release'den (Onerilen)

1. [Tampermonkey](https://www.tampermonkey.net/) yukleyin (Chrome, Firefox, Edge, Safari)
2. [Son release](https://github.com/umitaltintas/subscribe/releases/latest) sayfasindan `subscribe.user.js` dosyasini indirin
3. Tampermonkey panelini acip dosyayi surukleyin — veya yeni bir script olusturup icerigini yapistirin

### Kaynaktan Derleme

```bash
bun install
bun run build
```

Derlenen userscript `dist/userscript.js` konumunda olusur.

### Gelistirme

```bash
bun run watch      # Dosya degisikliklerinde otomatik derle
bun run typecheck  # TypeScript tip kontrolu
```

## Kullanim

Kurduktan sonra YouTube'da yeni butonlar goreceksiniz:

### Gezinme Cubugu
- **Transkript Yoneticisi** (belge ikonu) — Transkript kutuphanesi panelini acar
- **Ayarlar** (disli ikonu) — Yapay zeka ceviri ayarlarini yapilandirir

### Video Sayfasi
- **Transkript** butonu — Videonun transkriptini cikarir ve kaydeder
- **Cevir** butonu — Transkripti cevirir ve video uzerinde altyazi gosterir
- **Ozetle** butonu — Videonun yapay zeka ile ozetini olusturur

### Panel Sekmeleri

| Sekme | Aciklama |
|-------|----------|
| Gecmis | Tum kayitli transkriptler, fuzzy arama ve filtreler |
| Favoriler | Yer imi eklenen transkriptler |
| Ceviriler | Cevrilen transkriptleri goruntule ve yonet |
| Istatistikler | Toplam video, token, kelime, kanal sayilari |
| Ayarlar | Veri disa/ice aktarma, arama indexi yenileme |

### Yapay Zeka Cevirisi Kurulumu

1. [OpenRouter](https://openrouter.ai/) adresinden bir API anahtari alin
2. YouTube gezinme cubugundan ayarlar (disli) butonuna tiklayin
3. API anahtarinizi girin, model ve hedef dili secin
4. Herhangi bir videoda "Cevir" butonuna tiklayin — altyazilar oynatici uzerinde gorunecektir

## Teknoloji

- **TypeScript** — Tamamen tipli kod tabani
- **esbuild** — Tek IIFE userscript'e hizli paketleme
- **Fuse.js** — Istemci tarafli fuzzy arama motoru
- **IndexedDB** — Yerel depolama (sunucu yok, hesap yok)
- **OpenRouter API** — Coklu model destekli yapay zeka cevirisi ve ozetleme
- **Trusted Types** — CSP uyumlu DOM manipulasyonu

## Katki

Katkilasiniza acigiz! Issue acabilir veya pull request gonderebilirsiniz.

## Lisans

[MIT](../LICENSE)
