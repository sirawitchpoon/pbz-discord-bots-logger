import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { connectDB } from './utils/connectDB';
import logsRoutes from './routes/logs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', logsRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'discord-bots-logger' });
});

const PORT = Number(process.env.PORT) || 3002;

async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[Logger] API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
