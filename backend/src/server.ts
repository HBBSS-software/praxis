import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer, { type FileFilterCallback } from 'multer';

import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import studentRoutes from './routes/students';
import teacherRoutes from './routes/teachers';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(currentDir, '..', 'uploads');
const defaultPort = Number(process.env.PORT) || 3000;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_request, file, callback) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    callback(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback: FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extensionMatches = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeTypeMatches = allowedTypes.test(file.mimetype);

    if (extensionMatches && mimeTypeMatches) {
      callback(null, true);
      return;
    }

    callback(new Error('Only image uploads are allowed.'));
  }
});

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === 'null' || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS policy.'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    optionsSuccessStatus: 204
  })
);
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);

app.post('/api/upload', authMiddleware, upload.single('image'), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: 'No file uploaded.' });
    return;
  }

  const imageUrl = `/uploads/${request.file.filename}`;

  response.json({
    message: 'Upload successful.',
    imageUrl,
    filename: request.file.filename
  });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || 'Internal server error.' });
};

app.use(errorHandler);

export function startServer(port = defaultPort) {
  const server = app.listen(port, () => {
    const address = server.address();
    const resolvedPort = address && typeof address !== 'string' ? address.port : port;
    console.log(`Server running at http://localhost:${resolvedPort}`);
  });

  return server;
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  startServer();
}

export { app };
