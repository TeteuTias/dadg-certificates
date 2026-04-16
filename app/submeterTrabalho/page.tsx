"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Upload, AlertCircle } from "lucide-react";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";
import "./page.css";

interface Modality {
  name: string;
  code: string;
  description: string;
}

interface Event {
  _id: string;
  eventName: string;
  eventDescription: string;
  eventType: string;
  modalities: Modality[];
  isOpen: boolean;
  maxParticipants: number;
  registrationCount: number;
  isPaid: boolean;
  price?: number;
}

interface Author {
  name: string;
  email: string;
  institution: string;
  is_advisor: boolean;
}

interface Participant {
  name: string;
  email: string;
  role: string;
  is_advisor: boolean;
}

interface ProjectConfig {
  max_authors: number;
  max_participants: number;
  max_advisors: number;
}

export default function SubmeterTrabalho() {
  const { user } = useUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedModality, setSelectedModality] = useState<string>("");
  const [projectName, setProjectName] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [authors, setAuthors] = useState<Author[]>([
    { name: "", email: "", institution: "", is_advisor: false },
  ]);
  const [participants, setParticipants] = useState<Participant[]>([
    { name: "", email: "", role: "", is_advisor: false },
  ]);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>({
    max_authors: 1,
    max_participants: 4,
    max_advisors: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Buscar eventos ao carregar
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/v1/events/modalities", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro na resposta da API:", errorData);
        throw new Error(errorData.error || "Erro ao buscar eventos");
      }

      const data = await response.json();

      console.log("EVENTS RAW:", data);
      console.log("EVENTS DATA:", data.data);
      console.log("Array check:", Array.isArray(data.data));
      console.log("Array length:", data.data?.length);

      if (Array.isArray(data.data) && data.data.length > 0) {
        setEvents(data.data);
        console.log("Eventos carregados com sucesso:", data.data.length);
      } else {
        console.warn("Nenhum evento encontrado na resposta");
        setEvents([]);
        setError("Nenhum evento disponível para submissão no momento");
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao carregar eventos";
      setError(errorMessage);
      console.error("Erro ao buscar eventos:", err);
    }
  };

  const handleEventChange = (eventId: string) => {
    setSelectedEvent(eventId);
    setSelectedModality("");
  };

  const handleModalityChange = (modalityCode: string) => {
    setSelectedModality(modalityCode);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAuthorChange = (index: number, field: keyof Author, value: any) => {
    const newAuthors = [...authors];
    newAuthors[index] = { ...newAuthors[index], [field]: value };
    setAuthors(newAuthors);
  };

  const handleParticipantChange = (index: number, field: keyof Participant, value: any) => {
    const newParticipants = [...participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setParticipants(newParticipants);
  };

  const addAuthor = () => {
    if (authors.length < projectConfig.max_authors) {
      setAuthors([...authors, { name: "", email: "", institution: "", is_advisor: false }]);
    }
  };

  const removeAuthor = (index: number) => {
    setAuthors(authors.filter((_, i) => i !== index));
  };

  const addParticipant = () => {
    if (participants.length < projectConfig.max_participants) {
      setParticipants([...participants, { name: "", email: "", role: "", is_advisor: false }]);
    }
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validações
      if (!selectedEvent || !selectedModality || !projectName || !file) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      if (authors.some((a) => !a.name || !a.email || !a.institution)) {
        throw new Error("Preencha todos os dados dos autores");
      }

      if (participants.some((p) => !p.name || !p.email || !p.role)) {
        throw new Error("Preencha todos os dados dos participantes");
      }

      // Preparar FormData
      const formData = new FormData();
      formData.append("event_id", selectedEvent);
      formData.append("modality", selectedModality);
      formData.append("project_name", projectName);
      formData.append("file", file);
      formData.append("authors", JSON.stringify(authors));
      formData.append("participants", JSON.stringify(participants));
      formData.append("project_config", JSON.stringify(projectConfig));

      const response = await fetch("/api/v1/articles/submit", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao submeter trabalho");
      }

      setSuccess("Trabalho submetido com sucesso!");
      // Limpar formulário
      setSelectedEvent("");
      setSelectedModality("");
      setProjectName("");
      setFile(null);
      setAuthors([{ name: "", email: "", institution: "", is_advisor: false }]);
      setParticipants([{ name: "", email: "", role: "", is_advisor: false }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao submeter trabalho");
    } finally {
      setLoading(false);
    }
  };

  const currentEvent = events.find(
    (e) => String(e._id) === String(selectedEvent)
  );

  const currentModalities = currentEvent?.modalities ?? [];

  return (
    <div className="submit-container" style={PoppinsFontLib.style}>
      <div className="submit-header">
        <Link href="/" className="back-button">
          <ArrowLeft size={24} />
          <span>Voltar</span>
        </Link>
        <h1 className="submit-title">Submeter Trabalho</h1>
      </div>

      <div className="submit-content">
        <form onSubmit={handleSubmit} className="submit-form">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <span>{success}</span>
            </div>
          )}

          {/* Seção de Evento */}
          <div className="form-section">
            <h2 className="section-title">Informações do Evento</h2>

            <div className="form-group">
              <label htmlFor="event" className="form-label">
                Evento <span className="required">*</span>
              </label>
              <select
                id="event"
                value={selectedEvent}
                onChange={(e) => handleEventChange(e.target.value)}
                className="form-input"
                required
              >
                <option value="">Selecione um evento</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.eventName}
                  </option>
                ))}
              </select>
            </div>

            {currentEvent && (
              <div className="event-info">
                <p>
                  <strong>Descrição:</strong> {currentEvent.eventDescription}
                </p>
                <p>
                  <strong>Tipo de Evento:</strong> {currentEvent.eventType}
                </p>
                <p>
                  <strong>Vagas Disponíveis:</strong> {currentEvent.maxParticipants - currentEvent.registrationCount} de {currentEvent.maxParticipants}
                </p>
              </div>
            )}

            {currentModalities.length > 0 && (
              <div className="form-group">
                <label className="form-label">
                  Modalidade <span className="required">*</span>
                </label>
                <div className="modalities-grid">
                  {currentModalities.map((modality) => (
                    <div key={modality.code} className="modality-card">
                      <input
                        type="radio"
                        id={modality.code}
                        name="modality"
                        value={modality.code}
                        checked={selectedModality === modality.code}
                        onChange={(e) => handleModalityChange(e.target.value)}
                        className="modality-radio"
                      />
                      <label htmlFor={modality.code} className="modality-label">
                        <strong>{modality.name}</strong>
                        <p>{modality.description}</p>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Seção de Projeto */}
          <div className="form-section">
            <h2 className="section-title">Informações do Projeto</h2>

            <div className="form-group">
              <label htmlFor="projectName" className="form-label">
                Nome do Projeto <span className="required">*</span>
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="form-input"
                placeholder="Digite o nome do projeto"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="file" className="form-label">
                Arquivo do Trabalho <span className="required">*</span>
              </label>
              <div className="file-upload">
                <input
                  type="file"
                  id="file"
                  onChange={handleFileChange}
                  className="file-input"
                  required
                />
                <label htmlFor="file" className="file-label">
                  <Upload size={20} />
                  <span>{file ? file.name : "Clique para selecionar um arquivo"}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Seção de Autores */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">Autores</h2>
              <button
                type="button"
                onClick={addAuthor}
                className="btn-add"
                disabled={authors.length >= projectConfig.max_authors}
              >
                <Plus size={20} />
                Adicionar Autor
              </button>
            </div>

            {authors.map((author, index) => (
              <div key={index} className="author-card">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Nome <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={author.name}
                      onChange={(e) => handleAuthorChange(index, "name", e.target.value)}
                      className="form-input"
                      placeholder="Nome do autor"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Email <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      value={author.email}
                      onChange={(e) => handleAuthorChange(index, "email", e.target.value)}
                      className="form-input"
                      placeholder="Email do autor"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Instituição <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={author.institution}
                      onChange={(e) => handleAuthorChange(index, "institution", e.target.value)}
                      className="form-input"
                      placeholder="Instituição do autor"
                      required
                    />
                  </div>
                  <div className="form-group checkbox">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        checked={author.is_advisor}
                        onChange={(e) => handleAuthorChange(index, "is_advisor", e.target.checked)}
                        className="form-checkbox"
                      />
                      Orientador
                    </label>
                  </div>
                </div>

                {authors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAuthor(index)}
                    className="btn-remove"
                  >
                    <Trash2 size={18} />
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Seção de Participantes */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">Participantes</h2>
              <button
                type="button"
                onClick={addParticipant}
                className="btn-add"
                disabled={participants.length >= projectConfig.max_participants}
              >
                <Plus size={20} />
                Adicionar Participante
              </button>
            </div>

            {participants.map((participant, index) => (
              <div key={index} className="participant-card">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Nome <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={participant.name}
                      onChange={(e) => handleParticipantChange(index, "name", e.target.value)}
                      className="form-input"
                      placeholder="Nome do participante"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Email <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      value={participant.email}
                      onChange={(e) => handleParticipantChange(index, "email", e.target.value)}
                      className="form-input"
                      placeholder="Email do participante"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Função <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={participant.role}
                      onChange={(e) => handleParticipantChange(index, "role", e.target.value)}
                      className="form-input"
                      placeholder="Função do participante"
                      required
                    />
                  </div>
                  <div className="form-group checkbox">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        checked={participant.is_advisor}
                        onChange={(e) => handleParticipantChange(index, "is_advisor", e.target.checked)}
                        className="form-checkbox"
                      />
                      Orientador
                    </label>
                  </div>
                </div>

                {participants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeParticipant(index)}
                    className="btn-remove"
                  >
                    <Trash2 size={18} />
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Botão de Submissão */}
          <div className="form-actions">
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? "Submetendo..." : "Submeter Trabalho"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


