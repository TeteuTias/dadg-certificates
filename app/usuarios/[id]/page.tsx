"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import "../usuarios.css";

type Detail = { id:string; name:string; cpf:string; period:number; updatedAt:string; privacy:{accepted:boolean;noticeVersion:string;acceptedAt:string|null} };
type Audit = { id:string; action:string; changedFields:string[]; actorSubject:string; createdAt:string };

export default function UsuarioDetalhePage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Detail | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [form, setForm] = useState({ name:"", cpf:"", period:"" });
  const [status, setStatus] = useState<"loading"|"idle"|"saving"|"saved"|"error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    const response = await fetch(`/api/v1/admin/profiles/${params.id}`, { cache:"no-store" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Não foi possível carregar o perfil."); setStatus("error"); return; }
    setProfile(data.profile); setAudit(data.audit || []);
    setForm({ name:data.profile.name, cpf:data.profile.cpf, period:String(data.profile.period) }); setStatus("idle");
  }, [params.id]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setStatus("saving"); setMessage("");
    const response = await fetch(`/api/v1/admin/profiles/${params.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:form.name, cpf:form.cpf, period:Number(form.period) }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || Object.values(data.fields || {})[0] || "Não foi possível salvar."); setStatus("error"); return; }
    setStatus("saved"); setMessage("Alterações salvas e registradas na auditoria."); await load();
  }

  return <main className="users-admin-shell">
    <section className="users-admin-hero">
      <Link href="/usuarios" className="users-admin-link"><ArrowLeft size={16} /> Voltar para usuários</Link>
      <div className="users-admin-title-row"><div><h1>Detalhe do perfil</h1><p>Correções afetam apenas novas inscrições. Certificados e participações anteriores permanecem como snapshots.</p></div></div>
    </section>
    {status === "loading" && !profile ? <section className="users-admin-panel users-admin-empty"><LoaderCircle className="animate-spin" />Carregando...</section> : null}
    {profile ? <div className="users-detail-grid">
      <section className="users-admin-panel users-detail-card">
        <h2>Dados cadastrais</h2>
        <form onSubmit={submit} className="users-detail-form">
          <label><span>Nome completo</span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength={5} maxLength={120} required /></label>
          <label><span>CPF</span><input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})} inputMode="numeric" required /></label>
          <label><span>Período</span><select value={form.period} onChange={e=>setForm({...form,period:e.target.value})} required>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}º período</option>)}</select></label>
          {message ? <div role={status==="error"?"alert":"status"} className={status==="error"?"users-admin-error":"users-detail-success"}>{message}</div> : null}
          <button type="submit" disabled={status==="saving"} className="users-detail-save">{status==="saving"?<LoaderCircle className="animate-spin" size={18}/>:<Save size={18}/>} {status==="saving"?"Salvando...":"Salvar correção"}</button>
        </form>
      </section>
      <aside className="users-admin-panel users-detail-card"><h2>Privacidade</h2><div className="users-privacy-state"><ShieldCheck size={22}/><div><strong>{profile.privacy.accepted?"Aceite vigente":"Novo aceite necessário"}</strong><p>{profile.privacy.noticeVersion}</p>{profile.privacy.acceptedAt?<p>{new Date(profile.privacy.acceptedAt).toLocaleString("pt-BR")}</p>:null}</div></div><p className="users-detail-note">O administrador não pode aceitar a LGPD em nome do aluno.</p></aside>
      <section className="users-admin-panel users-detail-card users-audit"><h2>Histórico de alterações</h2>{audit.length?audit.map(entry=><article key={entry.id}><div><strong>{entry.action}</strong><span>{new Date(entry.createdAt).toLocaleString("pt-BR")}</span></div><p>Campos: {entry.changedFields.join(", ")}. Ator: {entry.actorSubject}</p></article>):<p className="users-detail-note">Nenhuma alteração registrada.</p>}</section>
    </div> : null}
    {status === "error" && !profile ? <div className="users-admin-error" role="alert">{message}</div> : null}
    <style jsx global>{`.users-detail-grid{max-width:1180px;margin:1.25rem auto 0;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);gap:1.25rem}.users-detail-card{padding:1.5rem}.users-detail-card h2{color:#fff;font-size:1.25rem;font-weight:800;margin-bottom:1.25rem}.users-detail-form{display:grid;gap:1rem}.users-detail-form label{display:grid;gap:.4rem}.users-detail-form label>span{color:#94a3b8;font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.users-detail-form input,.users-detail-form select{height:50px;border:1px solid #334155;border-radius:14px;background:#0f172a;color:#f8fafc;padding:0 1rem;outline:none}.users-detail-form input:focus,.users-detail-form select:focus{border-color:#3b82f6;box-shadow:0 0 0 4px rgba(59,130,246,.12)}.users-detail-save{height:50px;border-radius:14px;background:#2563eb;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;gap:.5rem}.users-detail-save:disabled{opacity:.6}.users-detail-success{border:1px solid #065f46;background:rgba(6,95,70,.2);color:#a7f3d0;border-radius:14px;padding:1rem}.users-privacy-state{display:flex;gap:.8rem;color:#6ee7b7}.users-privacy-state p,.users-detail-note{color:#94a3b8;font-size:.82rem;margin-top:.25rem}.users-audit{grid-column:1/-1}.users-audit article{padding:1rem 0;border-top:1px solid #1e293b}.users-audit article>div{display:flex;justify-content:space-between;gap:1rem}.users-audit article span,.users-audit article p{color:#94a3b8;font-size:.8rem}.users-admin-link{display:inline-flex;align-items:center;gap:.35rem}@media(max-width:760px){.users-detail-grid{grid-template-columns:1fr}}`}</style>
  </main>;
}
