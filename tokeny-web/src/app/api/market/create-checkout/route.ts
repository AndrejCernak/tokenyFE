import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { callBackend, BackendError } from "../../_utils";

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
  } catch (e: unknown) {
    const err = e as BackendError;
    return NextResponse.json(err.body ?? { message: err.message }, { status: err.status ?? 500 });
  }
}
