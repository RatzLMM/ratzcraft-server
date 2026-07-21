import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import authRoutes from "./routes/auth";

dotenv.config();

async function start() {
    const app = Fastify();

    await app.register(cors);

    await app.register(jwt, {
        secret: process.env.JWT_SECRET || "dev-secret"
    });

    app.get("/", async () => ({
        name: "RatzCraft API",
        status: "online"
    }));

    app.get("/health", async () => {
        await prisma.$queryRaw`SELECT 1`;

        return {
            api: "online",
            database: "online"
        };
    });

    try {
        await app.register(authRoutes);
        await app.listen({
            host: "0.0.0.0",
            port: 3000
        });

        console.log("✅ API démarrée sur http://localhost:3000");
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

start();