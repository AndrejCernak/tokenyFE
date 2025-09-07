import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callBackend } from "../../_utils";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Not signed in" }, { status: 401 });

  try {
    const data = await callBackend("/wallet/me", { method: "GET" });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(e.body ?? { message: e.message }, { status: e.status ?? 500 });
  }
}
