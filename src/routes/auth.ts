import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

export default async function (app: FastifyInstance) {

    app.post("/auth/register", async (request, reply) => {

        const { username, email, password } = request.body as any;

        if (!username || !email || !password) {
            return reply.code(400).send({
                error: "Missing fields"
            });
        }

        const exists = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email }
                ]
            }
        });

        if (exists) {
            return reply.code(409).send({
                error: "User already exists"
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                uuid: uuid(),
                username,
                email,
                password: hash
            }
        });

        return {
            success: true,
            id: user.id
        };
    });

    app.post("/auth/login", async (request, reply) => {
        const { email, password } = request.body as any;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return reply.code(401).send({
                error: "Invalid credentials"
            });
        }

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
            return reply.code(401).send({
                error: "Invalid credentials"
            });
        }

        const token = app.jwt.sign({
            id: user.id,
            uuid: user.uuid,
            username: user.username
        });

        return {
            token,
            user: {
                id: user.id,
                uuid: user.uuid,
                username: user.username,
                email: user.email
            }
        };
    });

    app.get("/auth/me", {
        preHandler: async (request) => {
            await request.jwtVerify();
        }
    }, async (request: any) => {

        const user = await prisma.user.findUnique({
            where: {
                id: request.user.id
            }
        });

        return {
            id: user?.id,
            uuid: user?.uuid,
            username: user?.username,
            email: user?.email
        };
    });

}