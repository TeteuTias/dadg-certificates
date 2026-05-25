import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { BlogLikeModel, BlogBookmarkModel } from "@/lib/models/BlogInteractionModel";
import GateKeeper from "@/lib/security/gatekeeper";
import { ObjectId } from "bson";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "ID de post inválido" }, { status: 400 });
    }

    const keeper = new GateKeeper(request);
    const user = await keeper.identifySession();
    if (!user) {
      return NextResponse.json({ success: true, isLiked: false, isBookmarked: false }, { status: 200 });
    }

    await connectToDatabase();

    const [like, bookmark] = await Promise.all([
      BlogLikeModel.findOne({ postId: id, ownerId: user.sub }).lean(),
      BlogBookmarkModel.findOne({ postId: id, ownerId: user.sub }).lean(),
    ]);

    return NextResponse.json({
      success: true,
      isLiked: !!like,
      isBookmarked: !!bookmark
    }, { status: 200 });

  } catch (error: any) {
    console.error("Erro ao checar interações:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}
