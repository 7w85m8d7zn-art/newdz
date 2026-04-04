require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const multer = require('multer');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const buildNoticeUrl = (path, message) => {
  if (!message) return path;
  const params = new URLSearchParams({ notice: message });
  return `${path}?${params.toString()}`;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SECRET_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';
const storageEnabled = Boolean(supabaseUrl && supabaseServiceKey);
const supabase = storageEnabled
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const isVercel = Boolean(process.env.VERCEL);
const uploadsDir =
  process.env.UPLOADS_DIR ||
  (isVercel ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, 'public', 'uploads'));
let uploadsEnabled = true;
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  uploadsEnabled = false;
  console.warn('Yükleme klasörü oluşturulamadı, dosya yüklemeleri devre dışı:', error.message);
}

const storage = storageEnabled
  ? multer.memoryStorage()
  : uploadsEnabled
    ? multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          cb(null, safeName);
        }
      })
    : multer.memoryStorage();

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 8);
const uploadAllowed = storageEnabled || uploadsEnabled;
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!uploadAllowed) {
      return cb(new Error('Dosya yükleme devre dışı (salt-okunur dosya sistemi).'));
    }
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Sadece görsel dosyalar yüklenebilir.'));
  }
});

const ADMIN_PAGE_SIZE = Math.min(50, Math.max(10, Number(process.env.ADMIN_PAGE_SIZE || 20)));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'qr-menu-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '5m' }));

let storageReadyPromise = null;
const ensureStorageBucket = async () => {
  if (!supabase) return false;
  if (storageReadyPromise) return storageReadyPromise;
  storageReadyPromise = (async () => {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('Supabase bucket listesi alınamadı:', error.message);
      return false;
    }
    const exists = Array.isArray(data) && data.some((bucket) => bucket.name === storageBucket);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(storageBucket, {
        public: true
      });
      if (createError) {
        console.warn('Supabase bucket oluşturulamadı:', createError.message);
        return false;
      }
    }
    return true;
  })();
  return storageReadyPromise;
};

const uploadImage = async (file, folder) => {
  if (!file) return null;
  if (!storageEnabled) {
    return file.filename ? `/uploads/${file.filename}` : null;
  }
  const ready = await ensureStorageBucket();
  if (!ready) {
    console.warn('Supabase storage hazır değil, yükleme yapılamadı.');
    return null;
  }
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const objectPath = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  if (!buffer) return null;
  const { error } = await supabase.storage.from(storageBucket).upload(objectPath, buffer, {
    contentType: file.mimetype || 'image/jpeg',
    upsert: false
  });
  if (file.path) {
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      // ignore cleanup errors
    }
  }
  if (error) {
    console.warn('Görsel yüklenemedi:', error.message);
    return null;
  }
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(objectPath);
  return data?.publicUrl || null;
};

const cacheStore = {
  settings: { value: null, expires: 0 },
  stats: { value: null, expires: 0 },
  qr: new Map()
};

const getCached = async (key, ttlMs, fetcher) => {
  const now = Date.now();
  const entry = cacheStore[key];
  if (entry?.value && entry.expires > now) {
    return entry.value;
  }
  const value = await fetcher();
  cacheStore[key] = { value, expires: now + ttlMs };
  return value;
};

const invalidateCache = (key) => {
  if (!key || !cacheStore[key]) return;
  cacheStore[key] = { value: null, expires: 0 };
};

const getCachedStats = async () =>
  getCached('stats', 15000, async () => {
    const stats = await db.getScanStats();
    const sevenTotal = stats.recent.reduce((sum, item) => sum + item.count, 0);
    const catalog = await db.getCatalogStats();
    return { ...stats, sevenTotal, catalog };
  });

const getCachedQr = async (targetUrl) => {
  const now = Date.now();
  const entry = cacheStore.qr.get(targetUrl);
  if (entry && entry.expires > now) return entry.data;
  const data = await QRCode.toDataURL(targetUrl, { margin: 1, width: 240 });
  cacheStore.qr.set(targetUrl, { data, expires: now + 5 * 60 * 1000 });
  return data;
};

const deleteUploadedFile = async (imagePath) => {
  if (!imagePath) return;
  if (storageEnabled) {
    const prefix = `/storage/v1/object/public/${storageBucket}/`;
    if (imagePath.includes(prefix)) {
      try {
        const url = new URL(imagePath);
        const parts = url.pathname.split(prefix);
        const objectPath = parts[1] ? decodeURIComponent(parts[1]) : null;
        if (objectPath) {
          await supabase.storage.from(storageBucket).remove([objectPath]);
          return;
        }
      } catch (err) {
        // fall back to local delete
      }
    }
  }
  if (!uploadsEnabled) return;
  if (!imagePath.startsWith('/uploads/')) return;
  const relativePath = imagePath.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsDir, relativePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) {
    return next();
  }
  return res.redirect('/login');
}

app.get('/', async (req, res) => {
  const settings = await getCached('settings', 5000, () => db.getSettings());
  const pageTitle = settings.hero_title || settings.welcome_title;
  res.render('home', { pageTitle, settings });
});

app.get('/menus', async (req, res) => {
  const categories = await db.getCategories();
  const selectedSlug = req.query.kategori;

  if (selectedSlug) {
    const category = await db.getCategoryBySlug(selectedSlug);
    if (!category) {
      return res.status(404).render('not_found', { pageTitle: 'Bulunamadı' });
    }
    const products = await db.getProductsByCategory(category.id);
    if (products.length === 0) {
      return res.redirect('/menus');
    }

    const categoriesWithProducts = [];
    for (const item of categories) {
      const itemProducts = await db.getProductsByCategory(item.id);
      if (itemProducts.length > 0) {
        categoriesWithProducts.push(item);
      }
    }

    return res.render('menus', {
      pageTitle: 'Menüler',
      categories: categoriesWithProducts,
      selectedSlug,
      sections: [{ category, products }]
    });
  }

  const categoriesWithProducts = [];
  const allProducts = [];
  for (const category of categories) {
    const products = await db.getProductsByCategory(category.id);
    if (products.length > 0) {
      categoriesWithProducts.push(category);
      allProducts.push(...products);
    }
  }

  const sections = allProducts.length > 0 ? [{ category: null, products: allProducts }] : [];

  return res.render('menus', {
    pageTitle: 'Menüler',
    categories: categoriesWithProducts,
    selectedSlug: 'all',
    sections
  });
});

app.get('/menus/:slug', (req, res) => {
  const slug = encodeURIComponent(req.params.slug);
  res.redirect(`/menus?kategori=${slug}`);
});

app.get('/qr', async (req, res) => {
  await db.logQrScan();
  res.redirect('/menus');
});

app.get('/login', (req, res) => {
  if (req.session?.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { pageTitle: 'Admin Girişi', error: null });
});

app.post('/login', (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  return res.status(401).render('admin/login', {
    pageTitle: 'Admin Girişi',
    error: 'Kullanıcı adı veya şifre hatalı.'
  });
});

app.get('/admin/login', (req, res) => {
  res.redirect('/login');
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.use('/admin', requireAdmin);

app.get('/admin', async (req, res) => {
  const { total, today, recent, sevenTotal, catalog } = await getCachedStats();
  const now = new Date();
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });
  res.render('admin/index', {
    pageTitle: 'Admin Paneli',
    stats: { total, today, recent },
    catalog,
    timeLabel,
    dateLabel
  });
});

app.get('/admin/stats', async (req, res) => {
  const payload = await getCachedStats();
  res.json(payload);
});

app.get('/admin/welcome', async (req, res) => {
  const settings = await getCached('settings', 5000, () => db.getSettings());
  res.render('admin/welcome', {
    pageTitle: 'Karşılama Sayfası',
    settings
  });
});

app.post(
  '/admin/welcome',
  upload.any(),
  async (req, res) => {
  const currentSettings = await db.getSettings();
  let backgroundImage = currentSettings.background_image || '';
  let logoImage = currentSettings.logo_image || '';
  const files = Array.isArray(req.files) ? req.files : [];
  const backgroundFile = files.find((file) => file.fieldname === 'background_image_file');
  const logoFile = files.find((file) => file.fieldname === 'logo_image_file');

  if (typeof req.body.background_image === 'string') {
    backgroundImage = req.body.background_image.trim();
  }

  if (typeof req.body.logo_image === 'string') {
    logoImage = req.body.logo_image.trim();
  }

  if (req.body.remove_background) {
    await deleteUploadedFile(currentSettings.background_image);
    backgroundImage = '';
  }

  if (backgroundFile) {
    const uploaded = await uploadImage(backgroundFile, 'welcome');
    if (uploaded) {
      await deleteUploadedFile(currentSettings.background_image);
      backgroundImage = uploaded;
    }
  }

  if (req.body.remove_logo) {
    await deleteUploadedFile(currentSettings.logo_image);
    logoImage = '';
  }

  if (logoFile) {
    const uploaded = await uploadImage(logoFile, 'welcome');
    if (uploaded) {
      await deleteUploadedFile(currentSettings.logo_image);
      logoImage = uploaded;
    }
  }

  await db.updateWelcome({
    hero_title: req.body.hero_title?.trim(),
    hero_slogan: req.body.hero_slogan?.trim(),
    hours_text: req.body.hours_text?.trim(),
    phone_text: req.body.phone_text?.trim(),
    instagram_url: req.body.instagram_url?.trim(),
    tiktok_url: req.body.tiktok_url?.trim(),
    powered_by: req.body.powered_by?.trim(),
    branch_name: req.body.branch_name?.trim(),
    branch_address: req.body.branch_address?.trim(),
    location_url: req.body.location_url?.trim(),
    location_button: req.body.location_button?.trim(),
    menu_button: req.body.menu_button?.trim(),
    background_image: backgroundImage,
    logo_image: logoImage
  });
  invalidateCache('settings');
  res.redirect(buildNoticeUrl('/admin/welcome', 'Ana sayfa içeriği güncellendi.'));
});

app.get('/admin/categories', async (req, res) => {
  const categories = await db.getCategories();
  res.render('admin/categories', {
    pageTitle: 'Menüler',
    categories
  });
});

app.post('/admin/categories', async (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    await db.addCategory(name);
  }
  const message = name ? `Kategori oluşturuldu: ${name}` : 'Değişiklikler yapıldı.';
  res.redirect(buildNoticeUrl('/admin/categories', message));
});

app.post('/admin/categories/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const categories = await db.getCategories();
  const target = categories.find((category) => category.id === id);
  await db.deleteCategory(id);
  const message = target?.name ? `Kategori silindi: ${target.name}` : 'Kategori silindi.';
  res.redirect(buildNoticeUrl('/admin/categories', message));
});

app.get('/admin/products', async (req, res) => {
  const categories = await db.getCategories();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(10, Number(req.query.limit) || ADMIN_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const result = await db.getAllProducts({ limit, offset, includeTotal: true });
  const products = result.products || [];
  const total = result.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.render('admin/products', {
    pageTitle: 'Ürünler',
    categories,
    products,
    total,
    page,
    totalPages,
    pageSize: limit
  });
});

app.post('/admin/products', upload.single('image'), async (req, res) => {
  const { categoryId, name, description, price } = req.body;
  let noticeMessage = 'Değişiklikler yapıldı.';
  if (categoryId && name?.trim()) {
    const imagePath = req.file ? await uploadImage(req.file, 'products') : null;
    const categories = await db.getCategories();
    const categoryName = categories.find((category) => category.id === Number(categoryId))?.name;
    await db.addProduct({
      categoryId: Number(categoryId),
      name: name.trim(),
      description: description?.trim() || null,
      price: price?.trim() || null,
      imagePath
    });
    if (categoryName) {
      noticeMessage = `${categoryName} - ${name.trim()} oluşturuldu.`;
    } else {
      noticeMessage = `Ürün oluşturuldu: ${name.trim()}`;
    }
  }
  res.redirect(buildNoticeUrl('/admin/products', noticeMessage));
});

app.get('/admin/products/:id/edit', async (req, res) => {
  const product = await db.getProductById(Number(req.params.id));
  if (!product) {
    return res.status(404).render('not_found', { pageTitle: 'Bulunamadı' });
  }
  const categories = await db.getCategories();
  return res.render('admin/product_edit', {
    pageTitle: 'Ürün Düzenle',
    categories,
    product
  });
});

app.post('/admin/products/:id/edit', upload.single('image'), async (req, res) => {
  const { categoryId, name, description, price, removeImage } = req.body;
  const id = Number(req.params.id);
  const existing = await db.getProductById(id);

  if (!existing) {
    return res.status(404).render('not_found', { pageTitle: 'Bulunamadı' });
  }

  let imagePath = existing.image_path || null;

  if (removeImage) {
    await deleteUploadedFile(imagePath);
    imagePath = null;
  }

  if (req.file) {
    const uploaded = await uploadImage(req.file, 'products');
    if (uploaded) {
      await deleteUploadedFile(imagePath);
      imagePath = uploaded;
    }
  }

  if (categoryId && name?.trim()) {
    await db.updateProduct({
      id,
      categoryId: Number(categoryId),
      name: name.trim(),
      description: description?.trim() || null,
      price: price?.trim() || null,
      imagePath
    });
  }
  const message = name?.trim() ? `Ürün güncellendi: ${name.trim()}` : 'Değişiklikler yapıldı.';
  res.redirect(buildNoticeUrl('/admin/products', message));
});

app.post('/admin/products/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.getProductById(id);
  if (existing?.image_path) {
    await deleteUploadedFile(existing.image_path);
  }
  await db.deleteProduct(id);
  const message = existing?.name ? `Ürün silindi: ${existing.name}` : 'Ürün silindi.';
  res.redirect(buildNoticeUrl('/admin/products', message));
});

app.get('/admin/qr', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const defaultUrl = `${baseUrl}/qr`;
  const targetUrl = (req.query.url || defaultUrl).toString();

  const qrData = await getCachedQr(targetUrl);

  res.render('admin/qr', {
    pageTitle: 'QR Kod',
    targetUrl,
    defaultUrl,
    qrData
  });
});

app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).send(`Yükleme hatası: ${err.message}`);
  }
  return next();
});

app.use((req, res) => {
  res.status(404).render('not_found', { pageTitle: 'Bulunamadı' });
});

app.listen(PORT, () => {
  console.log(`Sistem http://localhost:${PORT} adresinde çalışıyor`);
});
