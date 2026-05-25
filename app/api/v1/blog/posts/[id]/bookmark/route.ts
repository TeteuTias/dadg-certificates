import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BlogBookmarkModel } from "@/lib/models/BlogInteractionModel";
import BlogPostModel from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { ObjectId } from "bson";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "ID de post inválido" }, { status: 400 });
    }

    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não autenticado" }, { status: 401 });
    }

    await connectToDatabase();

    const post = await BlogPostModel.findById(id).lean();
    if (!post) {
      return NextResponse.json({ success: false, error: "Post não encontrado" }, { status: 404 });
    }

    // Verifica se já favoritou
    const existingBookmark = await BlogBookmarkModel.findOne({ postId: post._id, ownerId: user.sub });
    
    let isBookmarked = false;
    if (existingBookmark) {
      // Remover bookmark
      await BlogBookmarkModel.deleteOne({ _id: existingBookmark._id });
      isBookmarked = false;
    } else {
      // Adicionar bookmark
      await BlogBookmarkModel.create({ postId: post._id, ownerId: user.sub });
      isBookmarked = true;
    }

    return NextResponse.json({ success: true, isBookmarked }, { status: 200 });

  } catch (error: any) {
    console.error("Erro no Bookmark:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao processar bookmark" }, { status: 500 });
  }
}
