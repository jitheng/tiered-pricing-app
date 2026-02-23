import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { PrismaClient } from "../../prisma/generated/client";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Test Prisma import and connection
    const prisma = new PrismaClient();

    // Quick connection test
    await prisma.$connect();
    await prisma.$disconnect();

    return json({
      status: "success",
      message: "Prisma Client working correctly with custom output path",
      prismaClientAvailable: true,
    });
  } catch (error: any) {
    return json({
      status: "error",
      message: error.message,
      stack: error.stack,
      code: error.code,
    }, { status: 500 });
  }
}

export default function TestPrisma() {
  return <div>Check the JSON response</div>;
}
