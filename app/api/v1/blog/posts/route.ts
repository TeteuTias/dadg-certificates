import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const tag = searchParams.get("tag");

    const query: any = { status: "PUBLISHED" };
    if (tag) {
      query.tags = tag;
    }

    const posts = await BlogPostModel.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await BlogPostModel.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: posts,
      total,
      limit,
      skip,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao listar posts do blog:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao listar posts." },
      { status: 500 }
    );
  }
}
