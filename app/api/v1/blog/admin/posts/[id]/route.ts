import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import BlogPostModel from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { isAdmin } from "@/lib/security/isAdmin";
import { ObjectId } from "bson";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    const { id } = await params;
    
    if (!isAdmin(user)) {
      return NextResponse.json({ success: false, error: "Acesso Negado. Privilégios insuficientes." }, { status: 403 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "ID de post inválido." }, { status: 400 });
    }

    const body = await request.json();
    const { title, slug, excerpt, content, coverImage, authorName, tags, status } = body;

    await connectToDatabase();

    const postToUpdate = await BlogPostModel.findById(id);
    if (!postToUpdate) {
      return NextResponse.json({ success: false, error: "Artigo não encontrado." }, { status: 404 });
    }

    // Se estiver mudando o slug, verificar se já não existe outro com esse slug
    if (slug && slug !== postToUpdate.slug) {
      const existing = await BlogPostModel.findOne({ slug });
      if (existing) {
        return NextResponse.json({ success: false, error: "Já existe outro artigo com este URL amigável (slug)." }, { status: 400 });
      }
    }

    // Atualiza os campos fornecidos
    if (title) postToUpdate.title = title;
    if (slug) postToUpdate.slug = slug;
    if (excerpt) postToUpdate.excerpt = excerpt;
    if (content) postToUpdate.content = content;
    if (coverImage !== undefined) postToUpdate.coverImage = coverImage;
    if (authorName) postToUpdate.authorName = authorName;
    if (tags) postToUpdate.tags = tags;
    
    if (status && status !== postToUpdate.status) {
      postToUpdate.status = status;
      if (status === "PUBLISHED" && !postToUpdate.publishedAt) {
        postToUpdate.publishedAt = new Date();
      }
    }

    const updatedPost = await postToUpdate.save();

    return NextResponse.json({ success: true, data: updatedPost }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao atualizar post:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao atualizar o artigo" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    const { id } = await params;
    
    if (!isAdmin(user)) {
      return NextResponse.json({ success: false, error: "Acesso Negado. Privilégios insuficientes." }, { status: 403 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "ID de post inválido." }, { status: 400 });
    }

    await connectToDatabase();

    const deletedPost = await BlogPostModel.findByIdAndDelete(id);
    if (!deletedPost) {
      return NextResponse.json({ success: false, error: "Artigo não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Artigo excluído com sucesso." }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao excluir post:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao excluir o artigo" }, { status: 500 });
  }
}
