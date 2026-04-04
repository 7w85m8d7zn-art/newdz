const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY;
const seedDefaultCategories = process.env.SEED_DEFAULT_CATEGORIES === 'true';

const useSupabase = Boolean(supabaseUrl && supabaseServiceKey);
let supabase = null;

if (useSupabase) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) {
    console.warn('Uyarı: Service role anahtarı bulunamadı, anon anahtar kullanılıyor.');
  }
}

const defaultSettings = {
  welcome_title: 'Dondurmacı Zeki',
  welcome_subtitle: 'Taze ve el yapımı lezzetler için doğru yerdesiniz.',
  welcome_button: 'Menüleri Gör',
  hero_title: 'Dondurmacı Zeki',
  hero_slogan: "Nereden geliyorsun? DONDURMACI ZEKİ'den.\nNereye gidiyorsun? DONDURMACI ZEKİ'ye.",
  hours_text: 'Açık: 10:00 - 00:30',
  phone_text: '0533 792 02 42',
  instagram_url: 'https://instagram.com',
  tiktok_url: 'https://tiktok.com',
  powered_by: 'POWERED BY AJJANS MEDYA',
  branch_name: 'Karaköprü Şubesi',
  branch_address: 'Diyarbakır Yolu Cad. No:45, Karaköprü',
  location_url: 'https://maps.google.com',
  location_button: 'Konumu Gör',
  menu_button: 'Menüyü Görüntüle',
  background_image: '',
  logo_image: ''
};

function slugify(value) {
  if (!value) return '';

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i');

  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function getLocalDateStrings(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());

  return {
    date: `${year}-${month}-${day}`,
    dateTime: `${year}-${month}-${day} ${hour}:${minute}:${second}`
  };
}

// SQLite fallback
let sqlite = null;

function initSqlite() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const isVercel = Boolean(process.env.VERCEL);
  const defaultDbPath = isVercel
    ? path.join(os.tmpdir(), 'app.db')
    : path.join(dataDir, 'app.db');
  const dbPath = process.env.DB_PATH || defaultDbPath;
  sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price TEXT,
      image_path TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS qr_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scanned_at TEXT NOT NULL,
      scanned_date TEXT NOT NULL
    );
  `);

  const settingsCount = sqlite.prepare('SELECT COUNT(*) AS count FROM settings').get().count;
  if (settingsCount === 0) {
    const insert = sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    Object.entries(defaultSettings).forEach(([key, value]) => insert.run(key, value));
  }

  const categoryCount = sqlite.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
  if (categoryCount === 0) {
    const categories = ['Künefe', 'Kadayıf', 'Dondurma', 'İçecekler'];
    const insert = sqlite.prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)');
    categories.forEach((name, index) => {
      insert.run(name, slugify(name), index);
    });
  }

  // Update legacy ASCII category names to Turkish if they exist
  sqlite.prepare("UPDATE categories SET name = 'Künefe' WHERE name = 'Kunefe'").run();
  sqlite.prepare("UPDATE categories SET name = 'Kadayıf' WHERE name = 'Kadayif'").run();
  sqlite.prepare("UPDATE categories SET name = 'İçecekler' WHERE name = 'Icecekler'").run();

  const productColumns = sqlite.prepare("PRAGMA table_info(products)").all();
  const hasImagePath = productColumns.some((column) => column.name === 'image_path');
  if (!hasImagePath) {
    sqlite.exec('ALTER TABLE products ADD COLUMN image_path TEXT');
  }

  const hasSortOrder = productColumns.some((column) => column.name === 'sort_order');
  if (!hasSortOrder) {
    sqlite.exec('ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0');
  }

  const hasSortValues = sqlite.prepare('SELECT COUNT(*) AS count FROM products WHERE sort_order IS NOT NULL AND sort_order != 0').get().count;
  if (!hasSortValues) {
    const maxId = sqlite.prepare('SELECT MAX(id) AS max FROM products').get().max || 0;
    sqlite.prepare('UPDATE products SET sort_order = (? - id) + 1').run(maxId);
  }

  // Update legacy ASCII settings values if unchanged by user
  const legacySettings = [
    { key: 'welcome_title', from: 'Dondurmaci Zeki', to: 'Dondurmacı Zeki' },
    { key: 'welcome_subtitle', from: 'Taze ve el yapimi lezzetler icin dogru yerdesiniz.', to: 'Taze ve el yapımı lezzetler için doğru yerdesiniz.' },
    { key: 'welcome_button', from: 'Menuleri Gor', to: 'Menüleri Gör' },
    { key: 'hero_title', from: 'Dondurmaci Zeki', to: 'Dondurmacı Zeki' },
    { key: 'hero_slogan', from: "Nereden geliyorsun? DONDURMACI ZEKI'den.\nNereye gidiyorsun? DONDURMACI ZEKI'ye.", to: "Nereden geliyorsun? DONDURMACI ZEKİ'den.\nNereye gidiyorsun? DONDURMACI ZEKİ'ye." },
    { key: 'hours_text', from: 'Acik: 10:00 - 00:30', to: 'Açık: 10:00 - 00:30' },
    { key: 'branch_name', from: 'Karakopru Subesi', to: 'Karaköprü Şubesi' },
    { key: 'branch_address', from: 'Diyarbakir Yolu Cad. No:45, Karakopru', to: 'Diyarbakır Yolu Cad. No:45, Karaköprü' },
    { key: 'location_button', from: 'Konumu Gor', to: 'Konumu Gör' },
    { key: 'menu_button', from: 'Menuyu Goruntule', to: 'Menüyü Görüntüle' }
  ];

  const updateSetting = sqlite.prepare('UPDATE settings SET value = ? WHERE key = ? AND value = ?');
  legacySettings.forEach(({ key, from, to }) => updateSetting.run(to, key, from));
}

if (!useSupabase) {
  initSqlite();
}

async function ensureUniqueSlug(base) {
  if (!useSupabase) {
    let slug = base;
    let counter = 2;
    const exists = sqlite.prepare('SELECT 1 FROM categories WHERE slug = ?');
    while (exists.get(slug)) {
      slug = `${base}-${counter}`;
      counter += 1;
    }
    return slug;
  }

  let slug = base;
  let counter = 2;
  while (slug) {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .limit(1);

    if (error) {
      console.warn('Slug kontrolü başarısız:', error.message);
      return slug;
    }

    if (!data || data.length === 0) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }

  return `${base}-${Date.now()}`;
}

let seededCategories = false;
async function ensureDefaultCategories() {
  if (!useSupabase || seededCategories || !seedDefaultCategories) return;

  const { data: seededRow, error: seededError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'seeded_categories')
    .maybeSingle();

  if (!seededError && seededRow?.value === 'true') {
    seededCategories = true;
    return;
  }

  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.warn('Kategori sayımı başarısız:', error.message);
    return;
  }

  if (count === 0) {
    const categories = ['Künefe', 'Kadayıf', 'Dondurma', 'İçecekler'];
    const payload = categories.map((name, index) => ({
      name,
      slug: slugify(name),
      sort_order: index,
      active: true
    }));
    const { error: insertError } = await supabase.from('categories').insert(payload);
    if (insertError) {
      console.warn('Varsayılan kategoriler eklenemedi:', insertError.message);
    }
  }

  const { error: seedFlagError } = await supabase
    .from('settings')
    .upsert({ key: 'seeded_categories', value: 'true' }, { onConflict: 'key' });
  if (seedFlagError) {
    console.warn('Seed bayrağı yazılamadı:', seedFlagError.message);
  }

  seededCategories = true;
}

async function getSettings() {
  if (!useSupabase) {
    const rows = sqlite.prepare('SELECT key, value FROM settings').all();
    const settings = { ...defaultSettings };
    rows.forEach((row) => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) {
    console.warn('Ayarlar okunamadı:', error.message);
    return { ...defaultSettings };
  }

  const settings = { ...defaultSettings };
  data.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

async function updateWelcome(payload) {
  const data = {
    hero_title: payload.hero_title || payload.title || defaultSettings.hero_title,
    hero_slogan: payload.hero_slogan || payload.subtitle || defaultSettings.hero_slogan,
    hours_text: payload.hours_text || defaultSettings.hours_text,
    phone_text: payload.phone_text || defaultSettings.phone_text,
    instagram_url: payload.instagram_url || defaultSettings.instagram_url,
    tiktok_url: payload.tiktok_url || defaultSettings.tiktok_url,
    powered_by: payload.powered_by || defaultSettings.powered_by,
    branch_name: payload.branch_name || defaultSettings.branch_name,
    branch_address: payload.branch_address || defaultSettings.branch_address,
    location_url: payload.location_url || defaultSettings.location_url,
    location_button: payload.location_button || defaultSettings.location_button,
    menu_button: payload.menu_button || payload.button || defaultSettings.menu_button,
    background_image: payload.background_image || defaultSettings.background_image,
    logo_image: payload.logo_image || defaultSettings.logo_image
  };

  const updates = Object.entries(data).map(([key, value]) => ({
    key,
    value: String(value ?? '')
  }));

  // Backward compatible keys
  updates.push({ key: 'welcome_title', value: String(data.hero_title ?? '') });
  updates.push({ key: 'welcome_subtitle', value: String(data.hero_slogan ?? '') });
  updates.push({ key: 'welcome_button', value: String(data.menu_button ?? '') });

  if (!useSupabase) {
    const update = sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    updates.forEach(({ key, value }) => update.run(key, value));
    return;
  }

  const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'key' });
  if (error) {
    console.warn('Ayarlar güncellenemedi:', error.message);
  }
}

async function getCategories() {
  if (!useSupabase) {
    return sqlite.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, name ASC').all();
  }

  await ensureDefaultCategories();
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.warn('Kategoriler okunamadı:', error.message);
    return [];
  }
  return data || [];
}

async function getCategoryBySlug(slug) {
  if (!useSupabase) {
    return sqlite.prepare('SELECT * FROM categories WHERE slug = ? AND active = 1').get(slug);
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.warn('Kategori bulunamadı:', error.message);
    return null;
  }
  return data || null;
}

async function addCategory(name) {
  const baseSlug = slugify(name);
  const slug = await ensureUniqueSlug(baseSlug || `kategori-${Date.now()}`);

  if (!useSupabase) {
    const insert = sqlite.prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)');
    insert.run(name, slug, 0);
    return;
  }

  const { error } = await supabase.from('categories').insert({
    name,
    slug,
    sort_order: 0,
    active: true
  });

  if (error) {
    console.warn('Kategori eklenemedi:', error.message);
  }
}

async function deleteCategory(id) {
  if (!useSupabase) {
    sqlite.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return;
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    console.warn('Kategori silinemedi:', error.message);
  }
}

async function addProduct({ categoryId, name, description, price, imagePath }) {
  const sortOrder = await getNextProductSortOrder();
  if (!useSupabase) {
    const insert = sqlite.prepare('INSERT INTO products (category_id, name, description, price, image_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    insert.run(categoryId, name, description || null, price || null, imagePath || null, sortOrder);
    return;
  }

  const { error } = await supabase.from('products').insert({
    category_id: categoryId,
    name,
    description: description || null,
    price: price || null,
    image_path: imagePath || null,
    sort_order: sortOrder,
    active: true
  });

  if (error) {
    console.warn('Ürün eklenemedi:', error.message);
  }
}

async function deleteProduct(id) {
  if (!useSupabase) {
    sqlite.prepare('DELETE FROM products WHERE id = ?').run(id);
    return;
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    console.warn('Ürün silinemedi:', error.message);
  }
}

async function getProductById(id) {
  if (!useSupabase) {
    return sqlite.prepare('SELECT * FROM products WHERE id = ?').get(id);
  }

  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.warn('Ürün alınamadı:', error.message);
    return null;
  }
  return data || null;
}

async function updateProduct({ id, categoryId, name, description, price, imagePath }) {
  if (!useSupabase) {
    const update = sqlite.prepare(`
      UPDATE products
      SET category_id = ?, name = ?, description = ?, price = ?, image_path = ?
      WHERE id = ?
    `);
    update.run(categoryId, name, description || null, price || null, imagePath || null, id);
    return;
  }

  const { error } = await supabase
    .from('products')
    .update({
      category_id: categoryId,
      name,
      description: description || null,
      price: price || null,
      image_path: imagePath || null
    })
    .eq('id', id);

  if (error) {
    console.warn('Ürün güncellenemedi:', error.message);
  }
}

async function getProductsByCategory(categoryId, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : null;
  if (!useSupabase) {
    if (!limit) {
      return sqlite.prepare('SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY sort_order ASC, id DESC').all(categoryId);
    }
    return sqlite
      .prepare('SELECT * FROM products WHERE category_id = ? AND active = 1 ORDER BY sort_order ASC, id DESC LIMIT ?')
      .all(categoryId, limit);
  }

  let query = supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: false });

  if (limit) {
    query = query.range(0, limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.warn('Ürünler alınamadı (sort_order):', error.message);
    let fallbackQuery = supabase
      .from('products')
      .select('*')
      .eq('category_id', categoryId)
      .eq('active', true)
      .order('id', { ascending: false });

    if (limit) {
      fallbackQuery = fallbackQuery.range(0, limit - 1);
    }

    const fallback = await fallbackQuery;
    if (fallback.error) {
      console.warn('Ürünler alınamadı:', fallback.error.message);
      return [];
    }
    return fallback.data || [];
  }
  return data || [];
}

async function getAllProducts(options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : null;
  const offset = Number.isFinite(options.offset) ? options.offset : 0;
  const includeTotal = options.includeTotal === true;

  if (!useSupabase) {
    if (!limit) {
      return sqlite.prepare(`
        SELECT products.*, categories.name AS category_name
        FROM products
        JOIN categories ON categories.id = products.category_id
        ORDER BY products.sort_order ASC, products.id DESC
      `).all();
    }

    const products = sqlite.prepare(`
      SELECT products.*, categories.name AS category_name
      FROM products
      JOIN categories ON categories.id = products.category_id
      ORDER BY products.sort_order ASC, products.id DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    if (!includeTotal) {
      return products;
    }

    const total = sqlite.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    return { products, total };
  }

  if (!limit) {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: false });

    if (error) {
      console.warn('Ürün listesi alınamadı (sort_order):', error.message);
      const fallback = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('id', { ascending: false });
      if (fallback.error) {
        console.warn('Ürün listesi alınamadı:', fallback.error.message);
        return [];
      }
      return (fallback.data || []).map((row) => ({
        ...row,
        category_name: row.categories?.name || ''
      }));
    }

    return (data || []).map((row) => ({
      ...row,
      category_name: row.categories?.name || ''
    }));
  }

  const { data, error, count } = await supabase
    .from('products')
    .select('*, categories(name)', includeTotal ? { count: 'exact' } : undefined)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.warn('Ürün listesi alınamadı (sort_order):', error.message);
    const fallback = await supabase
      .from('products')
      .select('*, categories(name)', includeTotal ? { count: 'exact' } : undefined)
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    if (fallback.error) {
      console.warn('Ürün listesi alınamadı:', fallback.error.message);
      return includeTotal ? { products: [], total: 0 } : [];
    }
    const products = (fallback.data || []).map((row) => ({
      ...row,
      category_name: row.categories?.name || ''
    }));
    return includeTotal ? { products, total: fallback.count || 0 } : products;
  }

  const products = (data || []).map((row) => ({
    ...row,
    category_name: row.categories?.name || ''
  }));

  return includeTotal ? { products, total: count || 0 } : products;
}

async function getNextProductSortOrder() {
  if (!useSupabase) {
    const row = sqlite.prepare('SELECT MIN(sort_order) AS min FROM products').get();
    if (!row || row.min === null || typeof row.min === 'undefined') {
      return 1;
    }
    return Number(row.min) - 1;
  }

  const { data, error } = await supabase
    .from('products')
    .select('sort_order')
    .order('sort_order', { ascending: true })
    .limit(1);

  if (error) {
    console.warn('Sort sırası alınamadı:', error.message);
    return Date.now();
  }

  const min = data && data[0] ? Number(data[0].sort_order || 0) : 0;
  return min - 1;
}

async function updateProductOrder(ids, offset = 0) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const normalizedOffset = Number.isFinite(offset) ? offset : 0;
  const updates = ids.map((id, index) => ({
    id: Number(id),
    sort_order: normalizedOffset + index + 1
  }));

  if (!useSupabase) {
    const update = sqlite.prepare('UPDATE products SET sort_order = ? WHERE id = ?');
    const transaction = sqlite.transaction((rows) => {
      rows.forEach((row) => update.run(row.sort_order, row.id));
    });
    transaction(updates);
    return;
  }

  const { error } = await supabase.from('products').upsert(updates, { onConflict: 'id' });
  if (error) {
    console.warn('Ürün sırası güncellenemedi:', error.message);
  }
}

async function logQrScan() {
  const { date, dateTime } = getLocalDateStrings();
  if (!useSupabase) {
    sqlite.prepare('INSERT INTO qr_scans (scanned_at, scanned_date) VALUES (?, ?)').run(dateTime, date);
    return;
  }

  const { error } = await supabase.from('qr_scans').insert({
    scanned_at: dateTime,
    scanned_date: date
  });

  if (error) {
    console.warn('QR taraması kaydedilemedi:', error.message);
  }
}

function getSevenDaysAgoDate() {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  const pad = (value) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

async function getScanStats() {
  const { date } = getLocalDateStrings();

  if (!useSupabase) {
    const total = sqlite.prepare('SELECT COUNT(*) AS count FROM qr_scans').get().count;
    const today = sqlite.prepare('SELECT COUNT(*) AS count FROM qr_scans WHERE scanned_date = ?').get(date).count;
    const recent = sqlite.prepare(`
      SELECT scanned_date AS date, COUNT(*) AS count
      FROM qr_scans
      GROUP BY scanned_date
      ORDER BY scanned_date DESC
      LIMIT 7
    `).all();

    return { total, today, recent };
  }

  const [{ count: total = 0 } = {}, { count: today = 0 } = {}] = await Promise.all([
    supabase.from('qr_scans').select('id', { count: 'exact', head: true }),
    supabase.from('qr_scans').select('id', { count: 'exact', head: true }).eq('scanned_date', date)
  ]).then((results) => results.map((result) => (result.error ? { count: 0 } : result)));

  const since = getSevenDaysAgoDate();
  const { data: recentRows, error: recentError } = await supabase
    .from('qr_scans')
    .select('scanned_date')
    .gte('scanned_date', since)
    .order('scanned_date', { ascending: false });

  if (recentError) {
    console.warn('QR istatistikleri alınamadı:', recentError.message);
    return { total, today, recent: [] };
  }

  const counts = new Map();
  (recentRows || []).forEach((row) => {
    const key = row.scanned_date;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const recent = Array.from(counts.entries())
    .map(([dateKey, count]) => ({ date: dateKey, count }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 7);

  return { total, today, recent };
}

async function getCatalogStats() {
  if (!useSupabase) {
    const products = sqlite.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1').get().count;
    const categories = sqlite.prepare('SELECT COUNT(*) AS count FROM categories WHERE active = 1').get().count;
    return { products, categories };
  }

  const [{ count: products = 0 } = {}, { count: categories = 0 } = {}] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('active', true)
  ]).then((results) => results.map((result) => (result.error ? { count: 0 } : result)));

  return { products, categories };
}

module.exports = {
  getSettings,
  updateWelcome,
  getCategories,
  getCategoryBySlug,
  addCategory,
  deleteCategory,
  addProduct,
  deleteProduct,
  getProductById,
  updateProduct,
  getProductsByCategory,
  getAllProducts,
  updateProductOrder,
  logQrScan,
  getScanStats,
  getCatalogStats
};
