import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

// 1. Setup the Pool and Adapter once
const prismaClientSingleton = () => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Node.js specific: good to limit max connections in dev
    max: 10,
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
};

// 2. Standard Global attachment for Next.js HMR
declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
