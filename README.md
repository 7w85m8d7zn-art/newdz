# QR Menu Sistemi

Bu proje, QR ile acilan menu sayfalari ve admin paneli iceren basit bir menü sistemidir. Yerel SQLite veritabani kullanir.

## Kurulum

```bash
npm install
npm run start
```

Ardindan tarayicida `http://localhost:3000` adresini acin.

## Ozellikler

- Ana sayfa ve butonla menu listesini acma
- Coklu kategori (kunefe, kadayif, dondurma, icecekler)
- QR okutunca menu listesine yonlendirme ve okuma sayisi takibi
- Admin paneli
  - Gunluk ve toplam QR okuma sayisi
  - QR kod olusturucu
  - Menu kategorisi ve urun ekleme
  - Urune gorsel ekleme
  - Karsilama sayfasi icerik duzenleme
  - Login korumasi

## Veritabani

Varsayilan SQLite dosyasi: `data/app.db`

Urun gorselleri `public/uploads` klasorune kaydedilir.

DB yolunu degistirmek icin:

```bash
DB_PATH=/yeni/yol/app.db npm run start
```

## Admin Girisi

Varsayilan kullanici bilgileri:

- Kullanici: `admin`
- Sifre: `admin123`

Admin girisi: `http://localhost:3000/login`

Guvenlik icin ortam degiskenleriyle degistirin:

```bash
ADMIN_USER=zeki ADMIN_PASS=super-sifre SESSION_SECRET=uzun-bir-sifre npm run start
```

## Gercek Veritabanina Gecis (Ozet)

- `db.js` dosyasi su an SQLite icin yazildi.
- Ileride PostgreSQL/MySQL gibi bir sisteme gecmek isterseniz:
  - `db.js` icindeki sorgulari uygun surucu ile (ör. `pg` veya `mysql2`) degistirebilirsiniz.
  - Alternatif olarak Prisma/Knex gibi bir ORM ile kolayca tasinabilir.

Hazirlik gerektiren bolumlerde yardima ihtiyaciniz olursa birlikte tasiyabiliriz.
# newdz
