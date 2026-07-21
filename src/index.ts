import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";

dotenv.config();

async function start() {
    const app = Fastify();

    await app.register(cors);

    await app.register(jwt, {
        secret: process.env.JWT_SECRET || "dev-secret"
    });

    app.get("/", async () => {
        return {
            name: "RatzCraft API",
            status: "online"
        };
    });

    try {
        await app.listen({
            port: 3000,
            host: "0.0.0.0"
        });

        console.log("✅ API démarrée sur http://localhost:3000");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
        api: "online",
        database: "online"
    };
    });
}

start();