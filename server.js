// ==================================================
// Сервер інвентаризації (Inventory Service) – Лабораторна №6
// ==================================================

// --- Імпорт необхідних модулів ---
const fs = require("fs");                 // Робота з файловою системою
const path = require("path");             // Робота з шляхами до файлів
const http = require("http");             // HTTP сервер
const express = require("express");       // Express для створення API
const { Command } = require("commander"); // Для командного рядка
const multer = require("multer");         // Для завантаження файлів
const { v4: uuidv4 } = require("uuid");   // Для генерації унікальних ID

// --- Swagger документація ---
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// ==================================================
// Налаштування командного рядка
// ==================================================
const program = new Command();
program
  .requiredOption("-h, --host <host>", "Адреса сервера")
  .requiredOption("-p, --port <port>", "Порт сервера")
  .requiredOption("-c, --cache <cacheDir>", "Шлях до директорії кешу");
program.parse(process.argv);
const options = program.opts();

const HOST = options.host;             // Адреса сервера
const PORT = parseInt(options.port);   // Порт сервера
const CACHE_DIR = path.resolve(options.cache); // Тека для збереження файлів

// ==================================================
// Перевірка і створення директорій
// ==================================================
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log("Створено теку кешу:", CACHE_DIR);
}

// --- Тека для завантажень ---
const UPLOADS_DIR = path.join(CACHE_DIR, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// --- Файл "бази даних" ---
const DB_FILE = path.join(CACHE_DIR, "inventory.json");
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

// ==================================================
// Функції для роботи з "базою даних" (JSON файл)
// ==================================================
function readDB() {
  // Читання даних з JSON файлу
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDB(data) {
  // Запис даних у JSON файл з відступами для зручності
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ==================================================
// Налаштування Express
// ==================================================
const app = express();
app.use(express.json());                  // Для парсингу JSON
app.use(express.urlencoded({ extended: true })); // Для парсингу form-data

// ==================================================
// Налаштування завантаження файлів через multer
// ==================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) =>
    cb(
      null,
      Date.now() + "-" + Math.random().toString(36).substring(2, 8) + ".jpg"
    ),
});
const upload = multer({ storage });

// ==================================================
// Swagger налаштування
// ==================================================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Сервіс інвентаризації",
      version: "1.0.0",
      description: "Документація до лабораторної №6 (WebAPI сервіс)",
    },
    servers: [{ url: `http://${HOST}:${PORT}` }],
  },
  apis: [path.join(__dirname, "*.js")], // Шукає Swagger коментарі у всіх JS файлах у директорії
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================================================
// Swagger коментарі для всіх методів
// ==================================================

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Зареєструвати нову річ
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва речі
 *               description:
 *                 type: string
 *                 description: Опис речі
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото речі
 *     responses:
 *       201:
 *         description: Річ успішно створена
 *       400:
 *         description: Поле "Ім’я речі" є обов’язковим
 */

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список усіх речей
 *     responses:
 *       200:
 *         description: Список речей
 */

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати річ за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID речі
 *     responses:
 *       200:
 *         description: Річ знайдено
 *       404:
 *         description: Річ не знайдено
 *   put:
 *     summary: Оновити дані речі за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID речі
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Річ оновлено
 *       404:
 *         description: Річ не знайдено
 *   delete:
 *     summary: Видалити річ за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID речі
 *     responses:
 *       200:
 *         description: Річ видалено
 *       404:
 *         description: Річ не знайдено
 */

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото речі за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Фото знайдено
 *       404:
 *         description: Річ або фото не знайдено
 *   put:
 *     summary: Оновити фото речі за ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Річ не знайдено
 */

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук речі за ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               has_photo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Річ знайдено
 *       404:
 *         description: Річ не знайдено
 */

// ==================================================
// Маршрути HTML форм
// ==================================================
app.get("/RegisterForm.html", (req, res) => {
  // Віддаємо HTML форму для реєстрації
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  // Віддаємо HTML форму для пошуку
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

// ==================================================
// API Маршрути
// ==================================================

// --- POST /register ---
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name || inventory_name.trim() === "") {
    return res.status(400).json({ помилка: "Поле 'Ім’я речі' є обов’язковим" });
  }

  const newItem = {
    id: uuidv4(),
    name: inventory_name.trim(),
    description: description || "",
    photo_path: req.file ? req.file.filename : null,
  };

  const db = readDB();
  db.push(newItem);
  writeDB(db);

  res.status(201).json({
    повідомлення: "Річ успішно зареєстровано",
    річ: newItem,
  });
});

// --- GET /inventory ---
app.get("/inventory", (req, res) => {
  const db = readDB();
  const base = `${req.protocol}://${req.get("host")}`;
  const items = db.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photo_path ? `${base}/inventory/${item.id}/photo` : null,
  }));
  res.json(items);
});

// --- GET /inventory/:id ---
app.get("/inventory/:id", (req, res) => {
  const id = req.params.id;
  const db = readDB();
  const item = db.find((x) => x.id === id);
  if (!item) return res.status(404).json({ помилка: "Річ не знайдено" });

  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    id: item.id,
    name: item.name,
    description: item.description,
    photo: item.photo_path ? `${base}/inventory/${item.id}/photo` : null,
  });
});

// --- PUT /inventory/:id ---
app.put("/inventory/:id", (req, res) => {
  const id = req.params.id;
  const { name, description } = req.body;
  const db = readDB();
  const index = db.findIndex((x) => x.id === id);

  if (index === -1) return res.status(404).json({ помилка: "Річ не знайдено" });

  if (name) db[index].name = name;
  if (description) db[index].description = description;
  writeDB(db);

  res.json({ повідомлення: "Річ оновлено", річ: db[index] });
});

// --- GET /inventory/:id/photo ---
app.get("/inventory/:id/photo", (req, res) => {
  const id = req.params.id;
  const db = readDB();
  const item = db.find((x) => x.id === id);

  if (!item) return res.status(404).send("Річ не знайдено");
  if (!item.photo_path) return res.status(404).send("Фото не знайдено");

  const photoPath = path.resolve(UPLOADS_DIR, item.photo_path);
  if (!fs.existsSync(photoPath)) return res.status(404).send("Фото не знайдено");

  res.setHeader("Content-Type", "image/jpeg");
  const stream = fs.createReadStream(photoPath);
  stream.pipe(res);
  stream.on("error", (err) => {
    console.error("Помилка при зчитуванні файлу:", err);
    res.status(500).send("Помилка сервера при зчитуванні фото");
  });
});

// --- PUT /inventory/:id/photo ---
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const id = req.params.id;
  const db = readDB();
  const index = db.findIndex((x) => x.id === id);

  if (index === -1) return res.status(404).json({ помилка: "Річ не знайдено" });

  if (db[index].photo_path) {
    const old = path.join(UPLOADS_DIR, db[index].photo_path);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  db[index].photo_path = req.file ? req.file.filename : null;
  writeDB(db);
  res.json({ повідомлення: "Фото оновлено", річ: db[index] });
});

// --- DELETE /inventory/:id ---
app.delete("/inventory/:id", (req, res) => {
  const id = req.params.id;
  const db = readDB();
  const index = db.findIndex((x) => x.id === id);

  if (index === -1) return res.status(404).json({ помилка: "Річ не знайдено" });

  const item = db[index];
  if (item.photo_path) {
    const photoPath = path.join(UPLOADS_DIR, item.photo_path);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }

  db.splice(index, 1);
  writeDB(db);

  res.json({ повідомлення: "Річ видалено" });
});


// --- GET /search (форма викладача, method=GET) ---
app.get("/search", (req, res) => {
  const id = req.query.id;
  const includePhoto = req.query.includePhoto === "on";

  const db = readDB();
  const item = db.find((x) => x.id === id);

  if (!item) {
    return res.status(404).send(`
      <h3>Річ не знайдено</h3>
      <a href="/SearchForm.html">Назад</a>
    `);
  }

  let html = `
    <h2>Результат пошуку</h2>
    <p><b>ID:</b> ${item.id}</p>
    <p><b>Назва:</b> ${item.name}</p>
    <p><b>Опис:</b> ${item.description}</p>
  `;

  // Відображення фото
  if (includePhoto) {
    if (item.photo_path) {
      const photoUrl = `${req.protocol}://${req.get("host")}/inventory/${item.id}/photo`;
      html += `<p><img src="${photoUrl}" width="200"></p>`;
    } else {
      html += `<p><b>Фото:</b> немає</p>`;
    }
  }

  html += `<a href="/SearchForm.html">Назад</a>`;

  res.send(html);
});


// --- POST /search (для Postman) ---
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const db = readDB();
  const item = db.find((x) => x.id === id);

  if (!item) return res.status(404).json({ помилка: "Річ не знайдено" });

  const base = `${req.protocol}://${req.get("host")}`;
  let description = item.description;

  if (has_photo) {
    description += ` (Фото: ${
      item.photo_path ? base + "/inventory/" + item.id + "/photo" : "немає"
    })`;
  }

  res.json({
    id: item.id,
    name: item.name,
    description: description,
  });
});


// ==================================================
// Якщо метод не дозволено
// ==================================================
app.use((req, res) => {
  res.status(405).send("Метод не дозволений");
});

// ==================================================
// Запуск сервера
// ==================================================
const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`Сервер запущено на http://${HOST}:${PORT}`);
});
