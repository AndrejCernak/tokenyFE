import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callBackend } from "../../_utils";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Not signed in" }, { status: 401 });

  try {
    const body = await req.json();
    const data = await callBackend("/market/create-checkout", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(e.body ?? { message: e.message }, { status: e.status ?? 500 });
  }
}
