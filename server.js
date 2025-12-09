// ==================================================
// Сервер інвентаризації (Inventory Service) – Лабораторна №7 (Docker + DB)
// ==================================================

// --- Імпорт необхідних модулів --- нова зміна
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const uuidv4 = require("uuid").v4;
const http = require("http");

// **1. ДОДАНО: Використання dotenv та pg**
require('dotenv').config(); 
const { Pool } = require('pg');

// --- Swagger документація ---
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// ==================================================
// **2. ЗМІНЕНО: Конфігурація через .env (Commander ВИДАЛЕНО)**
// ==================================================
// Commander ВИДАЛЕНО, оскільки він викликав помилку та суперечить використанню .env
const HOST = '0.0.0.0'; // КРИТИЧНО: Слухаємо на всіх інтерфейсах для Docker
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const CACHE_DIR = path.resolve(process.env.CACHE_DIR || path.join(__dirname, 'cache'));

// ==================================================
// **3. ДОДАНО: Налаштування пулу підключень до PostgreSQL**
// ==================================================
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST, // 'db' з compose.yml
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
    // Додайте тут SSL/TLS, якщо використовуєте зовнішній хост, але для Docker це не потрібно
});

// Перевірка підключення до БД
pool.connect()
    .then(client => {
        console.log("Успішно підключено до PostgreSQL!");
        client.release();
    })
    .catch(err => {
        console.error("ПОМИЛКА ПІДКЛЮЧЕННЯ ДО БАЗИ ДАНИХ. Перевірте .env та compose.yml");
        console.error(err.message);
    });

/**
 * Виконує асинхронний запит до БД.
 * @param {string} text - SQL запит
 * @param {Array<any>} params - Параметри запиту
 * @returns {Promise<any>}
 */
async function queryDB(text, params) {
    return pool.query(text, params);
}

// ==================================================
// **4. ВИДАЛЕНО: Функції readDB та writeDB (замість JSON)**
// ==================================================
// Функції readDB() та writeDB() більше не потрібні, оскільки ми працюємо з PostgreSQL.


// ==================================================
// Перевірка і створення директорій (залишаємо для завантажень)
// ==================================================
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log("Створено теку кешу:", CACHE_DIR);
}

// --- Тека для завантажень ---
const UPLOADS_DIR = path.join(CACHE_DIR, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);


// ==================================================
// Налаштування Express та Multer
// ==================================================
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      description: "Документація до лабораторної №7 (Docker + DB)",
    },
    // ЗМІНА: Використовуємо нові змінні HOST/PORT
    servers: [{ url: `http://${HOST}:${PORT}` }], 
  },
  apis: [path.join(__dirname, "*.js")], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==================================================
// Swagger коментарі для всіх методів (ЗАЛИШАЮТЬСЯ БЕЗ ЗМІН)
// ==================================================

/**
 * @swagger
 * /register:
 * ... (коментарі) ...
 */

/**
 * @swagger
 * /inventory:
 * ... (коментарі) ...
 */

// ... (Усі ваші коментарі Swagger) ...

// ==================================================
// Маршрути HTML форм (Без змін)
// ==================================================
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

// ==================================================
// **5. API Маршрути (ПЕРЕПИСАНІ на АСИНХРОННІ для PostgreSQL)**
// ==================================================

// --- POST /register ---
app.post("/register", upload.single("photo"), async (req, res) => {
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

    try {
        const queryText = `
            INSERT INTO inventory (id, name, description, photo_path)
            VALUES ($1, $2, $3, $4) RETURNING id, name, description, photo_path;
        `;
        const result = await queryDB(queryText, [
            newItem.id,
            newItem.name,
            newItem.description,
            newItem.photo_path,
        ]);
        
        res.status(201).json({
            повідомлення: "Річ успішно зареєстровано",
            річ: result.rows[0],
        });
    } catch (error) {
        console.error("Помилка при реєстрації в БД:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- GET /inventory ---
app.get("/inventory", async (req, res) => {
    try {
        const queryText = "SELECT id, name, description, photo_path FROM inventory;";
        const result = await queryDB(queryText, []);

        const base = `${req.protocol}://${req.get("host")}`;
        const items = result.rows.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            photo: item.photo_path ? `${base}/inventory/${item.id}/photo` : null,
        }));
        res.json(items);
    } catch (error) {
        console.error("Помилка при отриманні інвентарю:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- GET /inventory/:id ---
app.get("/inventory/:id", async (req, res) => {
    const id = req.params.id;
    try {
        const queryText = "SELECT id, name, description, photo_path FROM inventory WHERE id = $1";
        const result = await queryDB(queryText, [id]);
        const item = result.rows[0];

        if (!item) return res.status(404).json({ помилка: "Річ не знайдено" });

        const base = `${req.protocol}://${req.get("host")}`;
        res.json({
            id: item.id,
            name: item.name,
            description: item.description,
            photo: item.photo_path ? `${base}/inventory/${item.id}/photo` : null,
        });
    } catch (error) {
        console.error("Помилка при отриманні речі за ID:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- PUT /inventory/:id ---
app.put("/inventory/:id", async (req, res) => {
    const id = req.params.id;
    const { name, description } = req.body;

    try {
        const updateFields = [];
        const params = [];

        if (name) {
            params.push(name);
            updateFields.push(`name = $${params.length}`);
        }
        if (description) {
            params.push(description);
            updateFields.push(`description = $${params.length}`);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ повідомлення: "Немає даних для оновлення" });
        }

        params.push(id); // ID завжди останній параметр
        const queryText = `
            UPDATE inventory
            SET ${updateFields.join(', ')}
            WHERE id = $${params.length}
            RETURNING id, name, description, photo_path;
        `;
        const result = await queryDB(queryText, params);
        
        if (result.rowCount === 0) return res.status(404).json({ помилка: "Річ не знайдено" });

        res.json({ повідомлення: "Річ оновлено", річ: result.rows[0] });
    } catch (error) {
        console.error("Помилка при оновленні речі:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});


// --- GET /inventory/:id/photo ---
app.get("/inventory/:id/photo", async (req, res) => {
    const id = req.params.id;

    try {
        const queryText = "SELECT photo_path FROM inventory WHERE id = $1";
        const result = await queryDB(queryText, [id]);
        const item = result.rows[0];
    
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
    } catch (error) {
        console.error("Помилка при отриманні фото:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- PUT /inventory/:id/photo ---
app.put("/inventory/:id/photo", upload.single("photo"), async (req, res) => {
    const id = req.params.id;

    try {
        // 1. Отримати поточний шлях фото для видалення старого файлу
        const selectQuery = "SELECT photo_path FROM inventory WHERE id = $1";
        const selectResult = await queryDB(selectQuery, [id]);
        const item = selectResult.rows[0];

        if (!item) return res.status(404).json({ помилка: "Річ не знайдено" });

        // 2. Видалити старий файл (якщо він існує)
        if (item.photo_path) {
            const old = path.join(UPLOADS_DIR, item.photo_path);
            if (fs.existsSync(old)) fs.unlinkSync(old);
        }

        // 3. Оновити запис у БД
        const newPhotoPath = req.file ? req.file.filename : null;
        const updateQuery = "UPDATE inventory SET photo_path = $1 WHERE id = $2 RETURNING *";
        const updateResult = await queryDB(updateQuery, [newPhotoPath, id]);

        res.json({ повідомлення: "Фото оновлено", річ: updateResult.rows[0] });

    } catch (error) {
        console.error("Помилка при оновленні фото:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- DELETE /inventory/:id ---
app.delete("/inventory/:id", async (req, res) => {
    const id = req.params.id;

    try {
        // 1. Отримати поточний шлях фото для видалення файлу
        const selectQuery = "SELECT photo_path FROM inventory WHERE id = $1";
        const selectResult = await queryDB(selectQuery, [id]);
        const item = selectResult.rows[0];

        if (!item) return res.status(404).json({ помилка: "Річ не знайдено" });
        
        // 2. Видалити файл
        if (item.photo_path) {
            const photoPath = path.join(UPLOADS_DIR, item.photo_path);
            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        }

        // 3. Видалити запис із БД
        const deleteQuery = "DELETE FROM inventory WHERE id = $1";
        await queryDB(deleteQuery, [id]);

        res.json({ повідомлення: "Річ видалено" });

    } catch (error) {
        console.error("Помилка при видаленні речі:", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
});

// --- GET /search (форма викладача, method=GET) ---
// Зверніть увагу: функція тепер має бути асинхронною, оскільки вона викликає readDB
app.get("/search", async (req, res) => {
    const id = req.query.id;
    const includePhoto = req.query.includePhoto === "on";

    try {
        const queryText = "SELECT id, name, description, photo_path FROM inventory WHERE id = $1";
        const result = await queryDB(queryText, [id]);
        const item = result.rows[0];
    
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
    } catch (error) {
        console.error("Помилка при пошуку (GET /search):", error.message);
        res.status(500).send("Помилка сервера при роботі з БД");
    }
});


// --- POST /search (для Postman) ---
app.post("/search", async (req, res) => {
    const { id, has_photo } = req.body;

    try {
        const queryText = "SELECT id, name, description, photo_path FROM inventory WHERE id = $1";
        const result = await queryDB(queryText, [id]);
        const item = result.rows[0];

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
    } catch (error) {
        console.error("Помилка при пошуку (POST /search):", error.message);
        res.status(500).json({ помилка: "Помилка сервера при роботі з БД" });
    }
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
  console.log(`Документація доступна на http://${HOST}:${PORT}/docs`);
});