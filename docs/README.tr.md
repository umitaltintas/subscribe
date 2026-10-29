# SubScribe

[![Build](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml/badge.svg)](https://github.com/umitaltintas/subscribe/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/umitaltintas/subscribe)](https://github.com/umitaltintas/subscribe/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

YouTube transkript yöneticisi — fuzzy arama, yapay zekâ destekli çeviri & özetleme ve gerçek zamanlı altyazı özellikleriyle.

**[English](../README.md)** | **[Deutsch](README.de.md)** | **[Espanol](README.es.md)** | **[日本語](README.ja.md)**

## Özellikler

- **Tek Tıkla Transkript Çıkarma** — Herhangi bir YouTube videosunun transkriptini zaman damgalı veya damgasız olarak alın
- **Fuzzy Arama** — [Fuse.js](https://www.fusejs.io/) ile başlık, kanal, etiket ve transkript içinde yazım hatalarını tolere eden arama
- **Yapay Zekâ Çevirisi** — [OpenRouter](https://openrouter.ai/) üzerinden 18 dile çeviri (Gemini, Claude, GPT… her model kullanılabilir). Cümleler bölünmez, altyazılar yine de senkron kalır: model altyazı parçalarını cümleler hâlinde gruplar, her grubun zamanlaması ise modelden değil, doğrudan orijinal altyazılardan gelir
- **Güvenilir tasarım** — Kaynağa göre doğrulanan yapılandırılmış (JSON) çıktı, geri bildirimli otomatik yeniden deneme, hız sınırında bekleyip tekrar deneme, istediğiniz an iptal ve hata sonrası iki kez ödemeden kaldığı yerden devam
- **Tutarlı terminoloji** — İlk geçişte kısa bir video bağlamı ve terim sözlüğü oluşturulur; tüm parçalar buna uyar
- **Yapay Zekâ Özetleme** — Biçim, ton, uzunluk ve çıktı dilini seçin; önemli anlar tıklanabilir zaman damgalarıyla gelir
- **Milisaniye hassasiyeti** — Video açıkken zamanlama, transkript panelinin tam saniyeleri yerine YouTube oynatıcısının kendi altyazı verisinden (milisaniyelik başlangıç/bitiş) alınır; olmazsa otomatik olarak panele düşer
- **Zamanlama ayarı** — Altyazıyı ayarlardan ya da izlerken `[` / `]` tuşlarıyla (0,1 sn, Shift ile 0,5 sn) öne/geriye alın, `\` ile sıfırlayın (Türkçe Q klavyede ğ / ü / ,)
- **Altyazı Katmanı** — Oynatıcı üzerinde kare hassasiyetinde altyazılar, isteğe bağlı çift dilli mod (çeviri + orijinal), ayarlanabilir boyut/renk/arka plan; oynatıcı kontrollerinin önünden çekilir
- **Altyazı Dışa Aktarma** — Çevirileri `.srt` veya `.vtt` olarak indirin
- **Transkript Kütüphanesi** — Her şey IndexedDB'de yerel olarak saklanır: favoriler, etiketler, fuzzy arama ve istatistikler
- **Görüntüleyici** — Orijinal / Çeviri / Özet sekmeleri; bir zaman damgasına tıklayarak o ana gidin, geçerli satır oynatmayı takip eder
- **Maliyet Takibi** — Her çevirinin kesin maliyeti doğrudan OpenRouter tarafından bildirilir
- **Gizlilik** — API anahtarınız userscript deposunda tutulur (youtube.com tarafından okunamaz); istekler doğrudan OpenRouter'a gider
- **Açık & koyu tema**, klavyeyle erişilebilir diyaloglar ve menüler

## Kurulum

### Release'den (Önerilen)

1. [Tampermonkey](https://www.tampermonkey.net/) yükleyin (Chrome, Firefox, Edge, Safari)
2. [Son release](https://github.com/umitaltintas/subscribe/releases/latest) sayfasından `subscribe.user.js` dosyasını indirin
3. Tampermonkey panelini açıp dosyayı sürükleyin — veya yeni bir script oluşturup içeriğini yapıştırın

### Kaynaktan Derleme

```bash
bun install
bun run build
```

Derlenen userscript `dist/userscript.js` konumunda oluşur.

### Geliştirme

```bash
bun run watch      # Dosya değişikliklerinde otomatik derle
bun run typecheck  # TypeScript tip kontrolü
bun test           # Birim testleri (ayrıştırma, parçalama, doğrulama, çeviri akışı)
```

## Kullanım

Kurduktan sonra YouTube'da yeni butonlar göreceksiniz:

### Gezinme Çubuğu
- **Kütüphane** (SubScribe logosu) — Transkript kütüphanenizin bulunduğu paneli açar
- **Ayarlar** (dişli ikonu) — API anahtarı ("Test et" butonuyla), model (canlı fiyat bilgisiyle), diller, altyazı görünümü

### Video Sayfası
- **Transkript** — Videonun transkriptini çıkarır, etiketler ve kaydeder
- **Çevir** — Çeviriyi yapar ve altyazıları açar; ilerlemeyi gösterir (iptal için tıklayın). Kaydedildikten sonra aynı buton altyazıları açıp kapatır
- **Dil menüsü (▾)** — Hedef dili değiştirin, çeviriyi metin olarak görüntüleyin, yeniden çevirin, altyazı ayarları
- **Özetle** — Özet oluşturur; kaydedildikten sonra özeti açar

### Panel Sekmeleri

| Sekme | Açıklama |
|-------|----------|
| Geçmiş | Tüm kayıtlı transkriptler, fuzzy arama ve filtreler |
| Favoriler | Yer imi eklenen transkriptler |
| Çeviriler | Çevrilen transkriptleri görüntüle ve yönet |
| İstatistikler | Toplam video, token, kelime, kanal sayıları |
| Veri | Ayarlar kısayolu, dışa/içe aktarma (çeviriler & özetler dahil), arama dizinini yeniden oluşturma |

### Yapay Zekâ Çevirisi Kurulumu

1. [OpenRouter](https://openrouter.ai/) adresinden bir API anahtarı alın
2. YouTube gezinme çubuğundaki ayarlar (dişli) butonuna tıklayın
3. API anahtarınızı girip **Test et** butonuna basın, ardından model ve hedef dili seçin
4. Herhangi bir videoda **Çevir**'e tıklayın — çeviri biter bitmez altyazılar oynatıcıda görünür

## Teknoloji

- **TypeScript** — Tamamen tipli kod tabanı
- **esbuild** — Tek IIFE userscript'e hızlı paketleme
- **Fuse.js** — İstemci taraflı fuzzy arama motoru
- **IndexedDB** — Yerel depolama (sunucu yok, hesap yok)
- **OpenRouter API** — Yapılandırılmış çıktı ve maliyet takibi sunan çoklu model yapay zekâ
- **Trusted Types** — CSP uyumlu DOM manipülasyonu

## Proje Yapısı

```
src/
├── index.ts              # Giriş noktası, başlatma
├── config.ts             # Sabitler ve yapılandırma
├── types.ts              # TypeScript tip tanımları
├── db.ts                 # IndexedDB sarmalayıcısı (TranscriptDB)
├── transcript.ts         # YouTube DOM'undan transkript çıkarma
├── search.ts             # Fuse.js arama yöneticisi
├── ai.ts                 # Çeviri & özetleme prompt'ları ve işlem hattı
├── openrouter.ts         # OpenRouter istemcisi (yeniden deneme, yapılandırılmış çıktı, maliyet)
├── http.ts               # İptal destekli GM_xmlhttpRequest sarmalayıcısı
├── segments.ts           # Saf altyazı ayrıştırma, parçalama, doğrulama, SRT/VTT
├── timedtext.ts          # YouTube oynatıcısından milisaniyelik altyazı verisi
├── translation-service.ts # Tüm arayüzün paylaştığı işler, kalıcılık ve altyazılar
├── settings-store.ts     # Userscript deposunda ayarlar
├── subtitle-overlay.ts   # Video üzerinde gerçek zamanlı altyazı gösterimi
├── router.ts             # YouTube SPA gezinme yöneticisi
├── dom.ts                # DOM yardımcıları ve CSS enjeksiyonu
├── icons.ts              # SVG ikon kütüphanesi
├── utils.ts              # Yardımcı fonksiyonlar
├── trusted-types.ts      # Trusted Types politikası
├── global.d.ts           # Tampermonkey API tip bildirimleri
└── ui/
    ├── navbar.ts          # Üst çubuk butonları ve video sayfası eylemleri
    ├── dashboard.ts       # Kütüphane penceresi
    ├── viewer.ts          # Orijinal / çeviri / özet görüntüleyici
    ├── copy-modal.ts      # Kopyalama & etiketleme penceresi
    ├── settings.ts        # Ayarlar penceresi
    ├── summary-options.ts # Özet seçenekleri diyaloğu
    ├── modal.ts           # Erişilebilir modal + onay diyaloğu
    ├── menu.ts            # Açılır menü
    └── require-key.ts     # API anahtarı kontrolü
tests/                     # bun test paketleri
```

## Katkı

Katkılarınıza açığız! Issue açabilir veya pull request gönderebilirsiniz.

## Lisans

[MIT](../LICENSE)
