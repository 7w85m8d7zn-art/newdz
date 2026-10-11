# Dondurmacı Zeki QR Menü Sistemi

Bu proje, QR ile açılan Dondurmacı Zeki menüsü ve yönetim panelidir. Canlı ortamda Supabase kullanır; SQLite yalnızca Supabase yapılandırılmadığında yerel yedek olarak devreye girer.

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

## Supabase kurulumu

Supabase SQL Editor içinde önce [`supabase_schema.sql`](./supabase_schema.sql) dosyasını çalıştırın. Dosya 6 kategori ve 29 ürünü görselleriyle ekler; tekrar çalıştırıldığında mevcut kayıtları çoğaltmaz veya yönetim panelindeki kayıtları silmez.

Canlı ortamda şu değişkenler zorunludur:

```env
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_STORAGE_BUCKET="uploads"
ADMIN_USER="<benzersiz-kullanici-adi>"
ADMIN_PASS="<guclu-parola>"
SESSION_SECRET="<uzun-rastgele-gizli-deger>"
```

`SUPABASE_URL` yerine `NEXT_PUBLIC_SUPABASE_URL` da kullanılabilir. Gizli değerleri Git'e eklemeyin.

## Yerel veritabanı

Varsayilan SQLite dosyasi: `data/app.db`

Urun gorselleri `public/uploads` klasorune kaydedilir.

DB yolunu degistirmek icin:

```bash
DB_PATH=/yeni/yol/app.db npm run start
```

## Admin girişi

Admin girişi: `http://localhost:3000/login`

Yerel geliştirmede varsayılan bilgiler kullanılabilir; production ortamında uygulama `ADMIN_USER`, `ADMIN_PASS` ve `SESSION_SECRET` olmadan başlamaz:

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
