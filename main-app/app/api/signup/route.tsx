import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

async function hashPass(password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
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

  const passwordHash = await hashPass(safeBody.data.password);
  try {
    await prisma.user.create({
      data: {
        email: safeBody.data.email,
        passwordHash,
      },
    });
    return Response.json({
      success: "Account created successfull",
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return Response.json({ err: "Email already Exists" }, { status: 400 });
      }
    }
  }
  return Response.json({ err: "Internal server error" }, { status: 400 });
}
