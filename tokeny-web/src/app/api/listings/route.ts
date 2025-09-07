import { NextRequest, NextResponse } from "next/server";
import { callBackend, BackendError } from "../_utils";

export async function GET() {
  try {
    const data = await callBackend("/listings", { method: "GET" });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const err = e as BackendError;
    return NextResponse.json(err.body ?? { message: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await callBackend("/listings/create", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const err = e as BackendError;
    return NextResponse.json(err.body ?? { message: err.message }, { status: err.status ?? 500 });
  }
}
