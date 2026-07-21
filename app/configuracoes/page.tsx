"use client";

import { useEffect, useState } from "react";
import "./page.css";
import { Settings } from "lucide-react";

export default function ConfiguracoesPage() {
  const [blogEnabled, setBlogEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/v1/settings");
      if (res.ok) {
        const data = await res.json();
        setBlogEnabled(data.blogEnabled);
      }
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlog = async () => {
    if (blogEnabled === null) return;
    
    setSaving(true);
    setMessage("");
    
    const newValue = !blogEnabled;
    try {
      const res = await fetch("/api/v1/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ blogEnabled: newValue }),
      });

      if (res.ok) {
        setBlogEnabled(newValue);
        setMessage("Configuração salva com sucesso!");
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("Erro ao salvar configuração.");
      }
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      setMessage("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="configuracoes-container">
      <div className="configuracoes-header">
        <h1 className="configuracoes-title">
          <Settings className="inline-block mr-2" size={28} />
          Configurações Globais
        </h1>
        <p className="configuracoes-subtitle">
          Gerencie as opções do sistema que refletem no site principal.
        </p>
      </div>

      {loading ? (
        <p>Carregando configurações...</p>
      ) : (
        <div className="configuracoes-card">
          <div className="configuracoes-item-info">
            <h3>Blog do Diretório</h3>
            <p>
              Ao desativar, o blog deixará de aparecer no menu, na página de perfil 
              e as rotas do blog não ficarão acessíveis no site principal.
            </p>
          </div>
          <div className="flex flex-col items-end">
            <label className="configuracoes-switch">
              <input 
                type="checkbox" 
                checked={blogEnabled || false} 
                onChange={toggleBlog}
                disabled={saving}
              />
              <span className="configuracoes-slider"></span>
            </label>
          </div>
        </div>
      )}
      
      {message && <div className="configuracoes-status-msg">{message}</div>}
    </div>
  );
}
