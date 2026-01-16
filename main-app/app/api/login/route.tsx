import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

async function matchPass(password: string, hashedPassword: string) {
  const match = await bcrypt.compare(password, hashedPassword);
  return match;
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json(
      {
        error: "invalid body",
      },
      { status: 400 }
    );
  }

  const User = z.object({
    email: z.email(),
    password: z.string().min(8),
  });

  const safeBody = User.safeParse(body);
  if (!safeBody.success) {
    return Response.json(
      {
        err: "Invalid input",
      },
      { status: 400 }
    );
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: {
        email: safeBody.data.email,
      },
    });
  } catch (e) {
    return Response.json(
      {
        err: "Internal server error",
      },
      { status: 500 }
    );
  }

  if (!user) {
    return Response.json(
      {
        err: "Invalid email or password",
      },
      { status: 401 }
    );
  }

  const match = await matchPass(safeBody.data.password, user?.passwordHash);
  if (!match) {
    return Response.json(
      {
        err: "Invalid email or password",
      },
      { status: 401 }
    );
  }
  return Response.json({
    id: user.id,
    email: user.email,
  });
}
