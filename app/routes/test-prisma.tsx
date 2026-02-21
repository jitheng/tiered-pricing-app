import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Try to import Prisma
    const { PrismaClient } = await import("@prisma/client");

    return json({
      status: "success",
      message: "Prisma Client imported successfully",
      prismaClientAvailable: !!PrismaClient,
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
