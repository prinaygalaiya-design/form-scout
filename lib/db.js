import { PrismaClient } from './generated/prisma';

// Singleton to avoid creating multiple connections in Next.js hot-reload
const globalForPrisma = /** @type {any} */ (globalThis);
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// No-op: Prisma manages the schema via migrations
export async function ensureTable() {}

export async function savePrediction({ id, team1, team2, team1Id, team2Id, predictedWinner, confidence, predictedScore, gameDate, gameId }) {
  await prisma.prediction.create({
    data: { id, team1, team2, team1Id, team2Id, predictedWinner, confidence, predictedScore, gameDate, gameId },
  });
}

export async function fetchAllPredictions() {
  return prisma.prediction.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function fetchPendingPredictions() {
  const today = new Date().toISOString().split('T')[0];
  return prisma.prediction.findMany({
    where: {
      correct: null,
      gameId: { not: null },
      gameDate: { not: null, lte: today },
    },
  });
}

export async function updatePredictionResult(id, actualWinner, actualScore, correct) {
  await prisma.prediction.update({
    where: { id },
    data: { actualWinner, actualScore, correct },
  });
}

export async function predictionExistsForGame(gameId) {
  const count = await prisma.prediction.count({ where: { gameId } });
  return count > 0;
}
