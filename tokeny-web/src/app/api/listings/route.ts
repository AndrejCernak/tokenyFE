import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "../_utils";

export async function GET() {
  try {
    const data = await callBackend("/listings", { method: "GET" });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(e.body ?? { message: e.message }, { status: e.status ?? 500 });
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
  } catch (e: any) {
    return NextResponse.json(e.body ?? { message: e.message }, { status: e.status ?? 500 });
  }
}
