import mongoose, { Schema, Document } from "mongoose";

// COMENTÁRIOS
export interface IBlogComment extends Document {
  postId: mongoose.Types.ObjectId;
  ownerId: string; // Auth0 Sub
  ownerName: string;
  ownerPicture?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogCommentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "BlogPost", required: true },
    ownerId: { type: String, required: true },
    ownerName: { type: String, required: true },
    ownerPicture: { type: String, required: false },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const BlogCommentModel = mongoose.models.BlogComment || mongoose.model<IBlogComment>("BlogComment", BlogCommentSchema);


// CURTIDAS (LIKES)
export interface IBlogLike extends Document {
  postId: mongoose.Types.ObjectId;
  ownerId: string; // Auth0 Sub
  createdAt: Date;
}

const BlogLikeSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "BlogPost", required: true },
    ownerId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índice composto para impedir a mesma pessoa de curtir duas vezes no banco de dados
BlogLikeSchema.index({ postId: 1, ownerId: 1 }, { unique: true });

export const BlogLikeModel = mongoose.models.BlogLike || mongoose.model<IBlogLike>("BlogLike", BlogLikeSchema);


// FAVORITOS (BOOKMARKS - "Ler Depois")
export interface IBlogBookmark extends Document {
  postId: mongoose.Types.ObjectId;
  ownerId: string; // Auth0 Sub
  createdAt: Date;
}

const BlogBookmarkSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: "BlogPost", required: true },
    ownerId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índice composto
BlogBookmarkSchema.index({ postId: 1, ownerId: 1 }, { unique: true });

export const BlogBookmarkModel = mongoose.models.BlogBookmark || mongoose.model<IBlogBookmark>("BlogBookmark", BlogBookmarkSchema);
