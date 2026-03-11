import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) throw new Error('MONGO_URI is required');
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(mongoURI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });
  console.log('[Logger] MongoDB connected');
}
