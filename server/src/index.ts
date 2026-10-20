import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { errorHandler, notFound } from './middleware/error';
import { meRouter } from './routes/me';
import { messagesRouter } from './routes/messages';
import { roomsRouter } from './routes/rooms';

const app = express();

app.set('trust proxy', 1); // correct client IPs behind a hosting proxy
app.use(helmet());
app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/me', meRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api', messagesRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Chat API listening on http://localhost:${config.port}`);
});
