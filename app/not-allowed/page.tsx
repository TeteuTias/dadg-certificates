import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function NotAllowedPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center px-4">
      <section className="max-w-lg text-center rounded-3xl border border-slate-800 bg-slate-900/80 p-10">
        <ShieldX className="mx-auto text-rose-400" size={48} />
        <h1 className="mt-5 text-3xl font-black">Acesso não autorizado</h1>
        <p className="mt-3 text-slate-400">
          Esta conta não está na lista administrativa do DADG.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/auth/logout"
            className="rounded-xl bg-blue-600 px-5 py-3 font-bold"
          >
            Sair desta conta
          </Link>
        </div>
      </section>
    </main>
  );
}
