"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Image as ImageIcon, Loader2, Save } from "lucide-react";

type BlogPostForm = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  authorName: string;
  tags: string;
  status: "DRAFT" | "PUBLISHED";
};

const EMPTY_FORM: BlogPostForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  authorName: "",
  tags: "",
  status: "DRAFT",
};

function generateSlug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export default function BlogEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = params?.id ?? "novo";
  const isNewPost = postId === "novo";

  const [form, setForm] = useState<BlogPostForm>(EMPTY_FORM);
  const [isFetching, setIsFetching] = useState(!isNewPost);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");

  const loadPost = useCallback(async () => {
    setIsFetching(true);
    setError("");

    try {
      const response = await fetch("/api/v1/blog/admin/posts", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || "Não foi possível carregar o artigo.");
      }

      const post = (body.data as Array<Record<string, unknown>>).find((item) => String(item._id) === postId);
      if (!post) throw new Error("Artigo não encontrado.");

      setForm({
        title: String(post.title ?? ""),
        slug: String(post.slug ?? ""),
        excerpt: String(post.excerpt ?? ""),
        content: String(post.content ?? ""),
        coverImage: String(post.coverImage ?? ""),
        authorName: String(post.authorName ?? ""),
        tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
        status: post.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar o artigo.");
    } finally {
      setIsFetching(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!isNewPost) void loadPost();
  }, [isNewPost, loadPost]);

  const handleTitleChange = (value: string) => {
    setForm((previous) => {
      const shouldSyncSlug = isNewPost && (!previous.slug || previous.slug === generateSlug(previous.title));
      return shouldSyncSlug ? { ...previous, title: value, slug: generateSlug(value) } : { ...previous, title: value };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(
        isNewPost ? "/api/v1/blog/admin/posts" : `/api/v1/blog/admin/posts/${postId}`,
        {
          method: isNewPost ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            coverImage: form.coverImage.trim() || null,
            tags: form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }),
        },
      );

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || "Não foi possível salvar o artigo.");
      }

      router.push("/blog");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar o artigo.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600";

  const previewHtml = useMemo(() => form.content, [form.content]);

  if (isFetching) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-label="Carregando artigo" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 md:px-8">
      <div className="glass-card rounded-3xl border border-slate-200 p-6">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
          <ArrowLeft size={16} /> Voltar ao painel
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          {isNewPost ? "Criar novo artigo" : "Editar artigo"}
        </h1>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-6 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Título *</span>
            <input
              type="text"
              required
              value={form.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className={inputClass}
              placeholder="Ex: Como organizar seus estudos"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Slug (URL amigável) *</span>
            <input
              type="text"
              required
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              className={inputClass}
              placeholder="como-organizar-seus-estudos"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as BlogPostForm["status"] })}
              className={inputClass}
            >
              <option value="DRAFT">Rascunho (privado)</option>
              <option value="PUBLISHED">Publicado (público)</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Autor</span>
            <input
              type="text"
              value={form.authorName}
              onChange={(event) => setForm({ ...form, authorName: event.target.value })}
              className={inputClass}
              placeholder="Ex: Coordenadoria de Comunicação"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Resumo *</span>
            <textarea
              required
              rows={2}
              value={form.excerpt}
              onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
              className={`${inputClass} resize-none`}
              placeholder="Resumo curto exibido no card do artigo"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">URL da imagem de capa</span>
            <span className="flex gap-2">
              <span className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500">
                <ImageIcon size={18} />
              </span>
              <input
                type="url"
                value={form.coverImage}
                onChange={(event) => setForm({ ...form, coverImage: event.target.value })}
                className={inputClass}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </span>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Tags (separadas por vírgula)</span>
            <input
              type="text"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              className={inputClass}
              placeholder="Dicas, Eventos, Avisos"
            />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">Conteúdo (HTML) *</span>
            <button
              type="button"
              onClick={() => setShowPreview((previous) => !previous)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              <Eye size={14} /> {showPreview ? "Ocultar prévia" : "Ver prévia"}
            </button>
          </div>
          <textarea
            required
            rows={16}
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            className={`${inputClass} font-mono text-sm`}
            placeholder="<p>Escreva o artigo em HTML simples: &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;strong&gt;, &lt;a&gt;...</p>"
          />
          <p className="text-xs text-slate-500">
            O conteúdo é publicado como HTML no site principal. Use marcações simples como
            {" "}<code>&lt;p&gt;</code>, <code>&lt;h2&gt;</code>, <code>&lt;ul&gt;</code> e <code>&lt;a&gt;</code>.
          </p>
        </div>

        {showPreview && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Prévia</p>
            <div
              className="prose max-w-none text-slate-800"
              // Conteúdo escrito por administradores autenticados do DADG.
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <Link href="/blog" className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-700">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={18} />}
            {isNewPost ? "Criar artigo" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </main>
  );
}
