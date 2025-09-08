// src/middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // chráni všetky stránky okrem _next/static, favicon atď.
    "/((?!.*\\..*|_next).*)",
    "/",
    "/(api)(.*)",
  ],
};
