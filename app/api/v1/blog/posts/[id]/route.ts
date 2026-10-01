import { safeBlogHtml } from "@/lib/blog-html";
import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";

async function GETHandler(
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

    return NextResponse.json({ success: true, data: {...post, content: safeBlogHtml(post.content)} }, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar post por slug:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao buscar post." },
      { status: 500 }
    );
  }
}

export const GET = withRouteAccess(GETHandler);
