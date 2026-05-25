import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { isAdmin } from "@/lib/security/isAdmin";

export async function GET(request: NextRequest) {
  try {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    
    if (!isAdmin(user)) {
      return NextResponse.json({ success: false, error: "Acesso Negado. Privilégios insuficientes." }, { status: 403 });
    }

    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    // O admin pode ver TODOS os posts, independentemente do status
    const posts = await BlogPostModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await BlogPostModel.countDocuments();

    return NextResponse.json({
      success: true,
      data: posts,
      total,
      limit,
      skip,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao listar posts admin:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    
    if (!isAdmin(user)) {
      return NextResponse.json({ success: false, error: "Acesso Negado. Privilégios insuficientes." }, { status: 403 });
    }

    const body = await request.json();
    const { title, slug, excerpt, content, coverImage, authorName, tags, status } = body;

    if (!title || !slug || !excerpt || !content) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: title, slug, excerpt, content" }, { status: 400 });
    }

    await connectToDatabase();

    // Validar se o slug já existe
    const existing = await BlogPostModel.findOne({ slug });
    if (existing) {
      return NextResponse.json({ success: false, error: "Já existe um artigo com este URL amigável (slug)." }, { status: 400 });
    }

    const postToCreate = {
      title,
      slug,
      excerpt,
      content,
      coverImage: coverImage || null,
      authorName: authorName || user?.name || "Equipe DADG",
      tags: tags || [],
      status: status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    };

    const newPost = await BlogPostModel.create(postToCreate);

    return NextResponse.json({ success: true, data: newPost }, { status: 201 });

  } catch (error: any) {
    console.error("Erro ao criar post:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao salvar o artigo" }, { status: 500 });
  }
}
