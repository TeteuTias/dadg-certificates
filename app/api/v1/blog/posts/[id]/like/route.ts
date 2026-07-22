import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BlogLikeModel } from "@/lib/models/BlogInteractionModel";
import BlogPostModel from "@/lib/models/BlogPostModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { ObjectId } from "bson";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
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

    await connectToDatabase();
    session.startTransaction();

    const post = await BlogPostModel.findById(id).session(session);
    if (!post) {
      await session.abortTransaction();
      return NextResponse.json({ success: false, error: "Post não encontrado" }, { status: 404 });
    }

    // Verifica se já curtiu
    const existingLike = await BlogLikeModel.findOne({ postId: post._id, ownerId: user.sub }).session(session);
    
    let isLiked = false;
    if (existingLike) {
      // Remover like
      await BlogLikeModel.deleteOne({ _id: existingLike._id }).session(session);
      await BlogPostModel.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } }).session(session);
      isLiked = false;
    } else {
      // Adicionar like
      await BlogLikeModel.create([{ postId: post._id, ownerId: user.sub }], { session });
      await BlogPostModel.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } }).session(session);
      isLiked = true;
    }

    await session.commitTransaction();
    return NextResponse.json({ success: true, isLiked }, { status: 200 });

  } catch (error: any) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Erro no Like:", error);
    return NextResponse.json({ success: false, error: "Erro interno ao processar like" }, { status: 500 });
  } finally {
    session.endSession();
  }
}
