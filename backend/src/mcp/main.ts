/**
 * Lokal (stdio) MCP — Claude Desktop / Claude Code / Codex o'z kompyuteringizda
 * bazaga to'g'ridan-to'g'ri ulanganda. Faqat O'QISH amallari (egasi bazada yo'q,
 * shuning uchun yozish va audit yo'q). Internet orqali ulanish — /mcp (OAuth).
 *
 * MUHIM: stdout — MCP protokoli kanali. Winston va Prisma stdout'ga log
 * yozadi, bu protokolni buzadi. Shuning uchun stdout'ning haqiqiy yozuvchisi
 * faqat transportga beriladi, qolgan hamma chiqish stderr'ga buriladi.
 * Shu sababli modullar import emas, quyida require bilan (sozlamadan keyin)
 * yuklanadi.
 */
import path from 'path';
import { Writable } from 'stream';
import dotenv from 'dotenv';

const realStdoutWrite = process.stdout.write.bind(process.stdout);
const protocolOut = new Writable({
  write(chunk, encoding, callback) {
    realStdoutWrite(chunk, encoding as BufferEncoding, callback);
  },
});
process.stdout.write = ((...args: unknown[]) =>
  (process.stderr.write as (...a: unknown[]) => boolean)(...args)) as typeof process.stdout.write;

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true } as dotenv.DotenvConfigOptions);
if (process.env.ITLIVE_MCP_DATABASE_URL) process.env.DATABASE_URL = process.env.ITLIVE_MCP_DATABASE_URL;
// Prisma so'rov loglari kerak emas (development'da hammasini yozardi)
if (process.env.NODE_ENV === 'development') process.env.NODE_ENV = 'mcp-stdio';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('ITLIVE_MCP_DATABASE_URL yoki DATABASE_URL topilmadi. backend/.env faylini sozlang.');
  }
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const { createMcpServer } = require('./server') as typeof import('./server');
  const prisma = (require('../config/database') as typeof import('../config/database')).default;
  const { mcpConfig } = require('./config') as typeof import('./config');

  const server = createMcpServer({
    userId: null,
    fullName: 'Lokal ulanish (stdio)',
    role: 'admin',
    scopes: [mcpConfig.scopes.read],
    clientId: 'stdio',
    clientName: 'Lokal stdio',
    via: 'stdio',
  });
  const transport = new StdioServerTransport(process.stdin, protocolOut);
  transport.onclose = () => {
    void prisma.$disconnect();
  };
  await server.connect(transport);
  console.error('IT Live MCP (stdio, faqat o\'qish) ishga tushdi.');
}

void main().catch((error) => {
  console.error('IT Live MCP server ishga tushmadi:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
