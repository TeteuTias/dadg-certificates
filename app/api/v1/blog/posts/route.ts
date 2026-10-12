import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";

async function GETHandler(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
    const skip = Math.min(10000, Math.max(0, Number(searchParams.get("skip")) || 0));
    const tag = searchParams.get("tag");

    const query: {status:string;tags?:string} = { status: "PUBLISHED" };
    if (tag) {
      query.tags = tag;
    }

    const posts = await BlogPostModel.find(query).select("-contentHtml")
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

  } catch (error) {
    console.error("Erro ao listar posts do blog:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao listar posts." },
      { status: 500 }
    );
  }
}

export const GET = withRouteAccess(GETHandler);
