require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const QRCode = require('qrcode');
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

const storage = uploadsEnabled
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
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!uploadsEnabled) {
      return cb(new Error('Dosya yükleme devre dışı (salt-okunur dosya sistemi).'));
    }
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Sadece görsel dosyalar yüklenebilir.'));
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) {
    return next();
  }
  return res.redirect('/login');
}

function deleteUploadedFile(imagePath) {
  if (!uploadsEnabled) return;
  if (!imagePath || !imagePath.startsWith('/uploads/')) return;
  const relativePath = imagePath.replace(/^\/uploads\//, '');
  const filePath = path.join(uploadsDir, relativePath);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('Görsel silinemedi:', error.message);
  }
}

app.get('/', async (req, res) => {
  const settings = await db.getSettings();
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
  const stats = await db.getScanStats();
  const catalog = await db.getCatalogStats();
  const now = new Date();
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = now.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' });
  res.render('admin/index', {
    pageTitle: 'Admin Paneli',
    stats,
    catalog,
    timeLabel,
    dateLabel
  });
});

app.get('/admin/stats', async (req, res) => {
  const stats = await db.getScanStats();
  const sevenTotal = stats.recent.reduce((sum, item) => sum + item.count, 0);
  const catalog = await db.getCatalogStats();
  res.json({ ...stats, sevenTotal, catalog });
});

app.get('/admin/welcome', async (req, res) => {
  const settings = await db.getSettings();
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
    deleteUploadedFile(currentSettings.background_image);
    backgroundImage = '';
  }

  if (backgroundFile) {
    deleteUploadedFile(currentSettings.background_image);
    backgroundImage = `/uploads/${backgroundFile.filename}`;
  }

  if (req.body.remove_logo) {
    deleteUploadedFile(currentSettings.logo_image);
    logoImage = '';
  }

  if (logoFile) {
    deleteUploadedFile(currentSettings.logo_image);
    logoImage = `/uploads/${logoFile.filename}`;
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
  const products = await db.getAllProducts();
  res.render('admin/products', {
    pageTitle: 'Ürünler',
    categories,
    products
  });
});

app.post('/admin/products', upload.single('image'), async (req, res) => {
  const { categoryId, name, description, price } = req.body;
  let noticeMessage = 'Değişiklikler yapıldı.';
  if (categoryId && name?.trim()) {
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
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
    deleteUploadedFile(imagePath);
    imagePath = null;
  }

  if (req.file) {
    deleteUploadedFile(imagePath);
    imagePath = `/uploads/${req.file.filename}`;
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
    deleteUploadedFile(existing.image_path);
  }
  await db.deleteProduct(id);
  const message = existing?.name ? `Ürün silindi: ${existing.name}` : 'Ürün silindi.';
  res.redirect(buildNoticeUrl('/admin/products', message));
});

app.get('/admin/qr', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const defaultUrl = `${baseUrl}/qr`;
  const targetUrl = (req.query.url || defaultUrl).toString();

  const qrData = await QRCode.toDataURL(targetUrl, {
    margin: 1,
    width: 240
  });

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
