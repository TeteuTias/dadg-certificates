import mongoose, { Schema, Document } from "mongoose";

export interface IBlogPost extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  authorName: string;
  status: "DRAFT" | "PUBLISHED";
  tags: string[];
  likesCount: number;
  commentsCount: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    coverImage: { type: String, required: false },
    authorName: { type: String, required: true, default: "Equipe DADG" },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    tags: { type: [String], default: [] },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    publishedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

const BlogPostModel = mongoose.models.BlogPost || mongoose.model<IBlogPost>("BlogPost", BlogPostSchema);
export default BlogPostModel;
