# ACCESS — Toshkent xalqaro aeroporti uchun AI kiosk

Yoʻlovchi ovoz bilan (yoki yozib) istalgan tilda savol beradi, tizim aeroport va reyslar haqida javob beradi,
xaritada yoʻl koʻrsatadi, reyslar tablosini ochadi va murojaat qabul qiladi.

## Ishga tushirish

1. [Node.js](https://nodejs.org) 22.13 yoki undan yangi versiya kerak.
2. `start.bat` ni ishga tushiring (birinchi marta kutubxonalarni oʻzi oʻrnatadi).
   Birinchi ishga tushishda `.env` fayli yaratiladi va admin paroli konsolga chiqadi.
3. `.env` faylini oching va Google AI Studio kalitini yozing: `GEMINI_API_KEY=...`
   ([kalit olish](https://aistudio.google.com/apikey)). Serverni qayta ishga tushiring.
   Reyslar shaharlari ob-havosi uchun (Toshkent ob-havosi bosilganda ochiladigan oyna) — `OPENWEATHER_API_KEY=...`
   ([kalit olish](https://home.openweathermap.org/api_keys)). Kalitsiz faqat Toshkent ob-havosi koʻrinadi.
4. Kiosk: <http://127.0.0.1:3100/> — toʻliq ekran uchun `kiosk.bat`.
5. Admin panel: <http://127.0.0.1:3100/admin> — parol `.env` dagi `ADMIN_PASSWORD`.
   Parolni hech qachon README yoki boshqa repoga tushadigan faylga yozmang — `.env` gitga yuklanmaydi.
   Kiosk ekranida admin panelga havola yoʻq: istalgan matn maydonida ekran klaviaturasi bilan `tasffxh` deb yozilsa
   admin panel ochiladi (kod `public/js/app.js` dagi `ADMIN_CODE`). Shu yoʻl bilan kirilganda admin panelda ham
   ekran klaviaturasi ishlaydi.

Bilimlar bazasi: aeroport xizmatlari va narxlari `tools/kb-services.json` da. Bazaga qoʻshish —
`node tools/import-kb.mjs` (shu sarlavhali yozuv bor boʻlsa tegilmaydi; keyin admin panelda tahrirlanadi).

Roʻyxatdan oʻtish zonasi: admin panelda zona izohiga peshtaxtalar oraligʻini yozing (masalan `1-24`) —
roʻyxatdan oʻtish ochiq reys bosilganda yoʻlovchi shu zonaga yoʻnaltiriladi. Yozilmasa — kioskka eng yaqin zona.

Admin panelga boshqa kompyuterdan kirish kerak boʻlsa `.env` da `HOST=0.0.0.0` qiling.
Mikrofon brauzerda faqat `localhost`/`127.0.0.1` yoki HTTPS manzilda ishlaydi — kiosk brauzeri server bilan
bir kompyuterda boʻlsa muammo yoʻq, aks holda serverni HTTPS ortiga qoʻying.

## Admin panelda birinchi sozlash

1. **Xarita va hududlar** → qavat qoʻshing → aeroport xaritasini (JPG/PNG) yuklang.
2. **▱ Xona / toʻsiq** va **／ Devor** bilan yoʻlovchi oʻta olmaydigan joylarni chizing (eshiklarni ochiq qoldiring).
3. **＋ Kiosk joyi** bilan kiosk turgan nuqtani belgilang. Borish hududlari (hojatxona, kafe, peshtaxtalar, darvozalar
   va h.k.) chapdagi roʻyxatda boshqariladi: **＋ Yangi hudud** → xaritada joyini bosing → nomini yozib saqlang.
   Belgini xonaning eshigi oldiga qoʻying. Turi «Chiqish yoʻlagi (gate)» boʻlgan hududlar kioskda «Darvozalar»,
   qolganlari «Xizmatlar» roʻyxatida chiqadi.
4. **▶ Yoʻlni sinash** bilan marshrutlar toʻsiqlarni aylanib oʻtishini tekshiring.
5. **↔ Masshtab** — ikki nuqta orasidagi haqiqiy masofani kiritsangiz, kiosk piyoda yurish vaqtini koʻrsatadi.
6. **Bilimlar bazasi** → aeroport xizmatlari, ish vaqtlari, qoidalar, transport haqida maʼlumot yozing.
   AI faqat shu maʼlumot, xarita nuqtalari va reyslar tablosi asosida javob beradi.
7. **Sozlamalar** → salomlashuv matni, operator telefoni, ovoz.

Kioskda til tanlash tugmasi yoʻq: yoʻlovchi istalgan tilda soʻraydi, AI oʻsha tilda javob beradi.

Bir nechta qavat boʻlsa: lift/eskalator/zina nuqtalarini ikkala qavatda ham belgilab, ularga bir xil
«bogʻlanish kodi» yozing — marshrut shu orqali boshqa qavatga oʻtadi.

> Terminal xaritasi («Xalqaro terminal — uchish zali») tayyor holda kiritilgan: rasm `tools/terminal.jpg`,
> devorlar va nuqtalar `tools/terminal-map.js` da. Devorlar rasmga qarab chizilgan — taxminiy; kiosk joyi ham
> taxminiy qoʻyilgan. Ikkalasini admin paneldagi **Xarita va hududlar** boʻlimida toʻgʻrilang.
> Baza yangidan yaratilsa yoki `terminal-map.js` oʻzgartirilsa: `node tools/import-map.mjs`
> (admin panelda belgilangan kiosk joyi saqlanib qoladi, qolgan nuqtalar va toʻsiqlar fayldagi holatga qaytadi).

Logo — `public/img/logo.png` (shaffof fonli PNG). Sarlavhada, brauzer belgisida va bosh ekrandagi zarrachalar
emblemasida shu fayl ishlatiladi; almashtirish uchun faylni xuddi shu nom bilan yangilang.

## Qanday ishlaydi

| Qism | Texnologiya |
| --- | --- |
| Savol-javob | Gemini Interactions API (`gemini-3.8-flash`). Ovoz yozuvi toʻgʻridan-toʻgʻri modelga yuboriladi — til oʻzi aniqlanadi, aralash tilda gapirsa ham tushunadi. |
| Reyslar | `bot.uzairports.com/fids` jadvali har 60 soniyada oʻqiladi (TAS2 — xalqaro, TAS3 — mahalliy; uchish va qoʻnish). AI reyslarni `search_flights` funksiyasi orqali qidiradi. |
| Ovoz chiqarish | Gemini TTS (`gemini-3.8-flash-lite-tts`) — oʻzbek tilini qoʻllaydi, tilni matndan oʻzi aniqlaydi. Zaxira: brauzerning oʻz ovozi. |
| Xarita | Toʻsiqlar katakli toʻrga chiziladi, yoʻl A* algoritmi bilan topiladi (`public/js/pathfinder.js`). |
| Globus | Bitta shahar yoki reys soʻralganda (yoki tabloda reys bosilganda) 3D globusda Toshkent ↔ shahar yoʻnalishi koʻrsatiladi (`public/js/globeview.js`, globe.gl). Aeroport koordinatalari — `server/airports.json`, yer rasmi va chegaralar — `public/globe/`. Internet kerak emas. |
| Klaviatura | Kioskda oddiy klaviatura yoʻq: matn maydoni bosilganda ekran klaviaturasi ochiladi (oʻzbek, rus, ingliz, belgilar) — `public/js/keyboard.js`. |
| Maʼlumotlar | SQLite (`data/access.db`), yuklangan rasmlar `data/uploads/`. Zaxira nusxa uchun `data/` papkasini saqlang. |

Model nomlari **Sozlamalar** boʻlimida oʻzgartiriladi («Google modellar roʻyxatini olish» tugmasi mavjud modellarni koʻrsatadi).

## Papkalar

```
server/        Express server: API, FIDS, Gemini, TTS, admin
public/        Kiosk interfeysi (index.html, css/, js/)
public/admin/  Admin panel
tools/         Terminal xaritasi (rasm, devorlar, nuqtalar) va uni bazaga yozuvchi skript
test/          Testlar: npm test
data/          Baza va rasmlar (git ga kirmaydi)
```
