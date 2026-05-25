import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Slug não fornecido" }, { status: 400 });
    }

    await connectToDatabase();

    const post = await BlogPostModel.findOne({ slug: id, status: "PUBLISHED" }).lean();

    if (!post) {
      return NextResponse.json({ success: false, error: "Post não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: post }, { status: 200 });
  } catch (error: any) {
    console.error("Erro ao buscar post por slug:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao buscar post." },
      { status: 500 }
    );
  }
}
