"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Edit, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string | null;
  authorName?: string;
  status: "DRAFT" | "PUBLISHED";
  createdAt: string;
};

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/v1/blog/admin/posts", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setError("Acesso negado. Apenas administradores do DADG podem gerenciar o blog.");
        return;
      }
      if (!response.ok) throw new Error("Não foi possível carregar os artigos.");

      const body = await response.json();
      setPosts(Array.isArray(body?.data) ? body.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro inesperado ao carregar os artigos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const deletePost = async (post: BlogPost) => {
    if (!confirm(`Excluir definitivamente o artigo "${post.title}"?`)) return;

    setPendingId(post._id);
    setError("");

    try {
      const response = await fetch(`/api/v1/blog/admin/posts/${post._id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || "Não foi possível excluir o artigo.");
      }
      await loadPosts();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir o artigo.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 md:px-8">
      <div className="glass-card flex flex-col gap-5 rounded-3xl border border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">Blog do DADG</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Gerenciar publicações</h1>
          <p className="mt-2 text-sm text-slate-600">
            Crie, edite e publique os artigos exibidos em dadg.com.br/blog.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadPosts()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            <RefreshCw size={16} /> Atualizar
          </button>
          <Link
            href="/blog/editor/novo"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={18} /> Novo artigo
          </Link>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-label="Carregando artigos" />
        </div>
      ) : posts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">
          Nenhum artigo cadastrado até o momento.
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-5">Artigo</th>
                  <th className="p-5">Status</th>
                  <th className="p-5">Criado em</th>
                  <th className="p-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post._id} className="border-b border-slate-100 last:border-b-0">
                    <td className="p-5">
                      <div className="font-semibold text-slate-900">{post.title}</div>
                      <div className="mt-0.5 max-w-[280px] truncate font-mono text-xs text-slate-500">/{post.slug}</div>
                    </td>
                    <td className="p-5">
                      <span
                        className={`inline-flex w-max items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                          post.status === "PUBLISHED"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {post.status === "PUBLISHED" ? "PUBLICADO" : "RASCUNHO"}
                      </span>
                    </td>
                    <td className="p-5 text-sm text-slate-600">
                      {new Date(post.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/blog/editor/${post._id}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700"
                        >
                          <Edit size={16} /> Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void deletePost(post)}
                          disabled={pendingId === post._id}
                          className="rounded-xl p-2 text-red-600 disabled:opacity-50"
                          title="Excluir artigo"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
