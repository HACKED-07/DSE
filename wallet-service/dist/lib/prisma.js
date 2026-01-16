"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = __importDefault(require("pg"));
const client_1 = require("../src/generated/prisma/client");
// 1. Setup the Pool and Adapter once
const prismaClientSingleton = () => {
    const pool = new pg_1.default.Pool({
        connectionString: process.env.DATABASE_URL,
        // Node.js specific: good to limit max connections in dev
        max: 10,
    });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    return new client_1.PrismaClient({ adapter });
};
const prisma = (_a = globalThis.prismaGlobal) !== null && _a !== void 0 ? _a : prismaClientSingleton();
exports.default = prisma;
if (process.env.NODE_ENV !== "production")
    globalThis.prismaGlobal = prisma;
