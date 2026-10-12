import { withRouteAccess } from "@/lib/security/route-access";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BlogBookmarkModel } from "@/lib/models/BlogInteractionModel";
import BlogPostModel, { type IBlogPost } from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";

async function GETHandler(request: NextRequest) {
  try {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não autenticado" }, { status: 401 });
    }

    await connectToDatabase();

    // Encontra os bookmarks do usuário e popula com os dados do BlogPost
    const bookmarks = await BlogBookmarkModel.find({ ownerId: user.sub })
      .sort({ createdAt: -1 })
      .populate<{postId:IBlogPost|null}>({
        path: "postId",
        model: BlogPostModel,
        select: "title slug excerpt coverImage authorName tags likesCount commentsCount publishedAt createdAt status",
      })
      .lean();

    // Filtra apenas bookmarks em que o post ainda existe e está publicado
    const savedPosts = bookmarks
      .map((bm) => bm.postId)
      .filter((post) => post && post.status === "PUBLISHED");

    return NextResponse.json({ success: true, data: savedPosts }, { status: 200 });

  } catch (error) {
    console.error("Erro ao listar artigos salvos:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export const GET = withRouteAccess(GETHandler);
