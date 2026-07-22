import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BlogCommentModel } from "@/lib/models/BlogInteractionModel";
import BlogPostModel from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { ObjectId } from "bson";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "ID de post inválido" }, { status: 400 });
    }

    await connectToDatabase();
    
    // Lista os comentários do post ordenados do mais recente pro mais antigo
    const comments = await BlogCommentModel.find({ postId: id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: comments }, { status: 200 });
  } catch (error: any) {
    console.error("Erro ao listar comentários:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await mongoose.startSession();
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

    const { content } = await request.json();
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ success: false, error: "O conteúdo do comentário é obrigatório" }, { status: 400 });
    }

    await connectToDatabase();
    session.startTransaction();

    const post = await BlogPostModel.findById(id).session(session);
    if (!post) {
      await session.abortTransaction();
      return NextResponse.json({ success: false, error: "Post não encontrado" }, { status: 404 });
    }

    const newComment = await BlogCommentModel.create([{
      postId: post._id,
      ownerId: user.sub,
      ownerName: user.name || "Usuário",
      ownerPicture: user.picture,
      content: content.trim(),
    }], { session });

    // Atualiza a contagem no post
    await BlogPostModel.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } }).session(session);

    await session.commitTransaction();
    return NextResponse.json({ success: true, data: newComment[0] }, { status: 201 });

  } catch (error: any) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Erro ao criar comentário:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao processar comentário" }, { status: 500 });
  } finally {
    session.endSession();
  }
}
