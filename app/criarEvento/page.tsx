"use client"
import React, { useState } from 'react';
import ModalAction from "@/components/ModalAction";
import { IModalProps } from "@/components/ModalAction";
import "./page.css";

//
//
export default function Page() {
    return (
        <main className="create-event-container">
            <div className="create-event-form-wrapper glass-container">
                <CreateEventCertificateForm />
            </div>
        </main>
    )
}

const CreateEventCertificateForm: React.FC = () => {
    const [eventName, setEventName] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [templatePath, setTemplatePath] = useState('template04.png');
    const [templateVersePath, setTemplateVersePath] = useState('');

    const [modalOpenProps, setModalOpenProps] = useState<IModalProps & { isOpen: boolean }>({
        title: "Atenção",
        emoji: "",
        text: "Você está prestes a criar um Evento. Deseja continuar?",
        isOpen: false,
        buttons:
            [
                {
                    label: "", action: () => setModalOpenProps((prev) => ({ ...prev, isOpen: false })),
                }
            ]
    })

    const toggleModalOpenProps = (newState: Partial<IModalProps & { isOpen: boolean }>) => {
        setModalOpenProps((prev) => ({ ...prev, ...newState }))
    }



    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();


        const formData = new FormData()
        formData.append("eventName", eventName)
        formData.append("eventDescription", eventDescription)
        formData.append("templatePath", templatePath)
        formData.append("templateVersePath", templateVersePath)

        // Aqui você pode fazer a chamada à sua API que insere o documento no MongoDB

        const data = await fetch("/api/put/createNewEvent/", {
            method: "PUT",
            body: formData
        })

        if (!data.ok) {
            const dataJson: { message: string } = await data.json()
            toggleModalOpenProps({
                text: dataJson.message,
                isOpen: true,
                buttons: [
                    {
                        label: "Fechar",
                        action: () => toggleModalOpenProps({ isOpen: false })
                    }
                ]

            })
            return;
        }

        const dataJson: { message: string } = await data.json()
        toggleModalOpenProps({
            text: dataJson.message,
            isOpen: true,
            buttons: [
                {
                    label: "Obrigado(a)!",
                    action: () => toggleModalOpenProps({ isOpen: false })
                }
            ]

        })

        // Limpa os campos do formulário (opcional)
        setEventName('');
        setEventDescription('');

    };

    return (
        <>

            {
                modalOpenProps.isOpen &&
                <ModalAction {...modalOpenProps} />
            }
            <>
                <h1 className="create-event-title">Criar Evento</h1>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="eventName" className="form-label">
                            Nome do Evento
                        </label>
                        <input
                            type="text"
                            id="eventName"
                            className="glass-input form-input"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="eventDescription" className="form-label">
                            Descrição do Evento
                        </label>
                        <textarea
                            id="eventDescription"
                            className="glass-input form-textarea"
                            value={eventDescription}
                            onChange={(e) => setEventDescription(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="templatePath" className="form-label">
                            Template - Frente
                        </label>
                        <textarea
                            id="templatePath"
                            className="glass-input form-textarea"
                            value={templatePath}
                            onChange={(e) => setTemplatePath(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="templateVersePath" className="form-label">
                            Template - Verso
                            <span className="form-label-hint">Deixe em branco se não houver verso</span>
                        </label>
                        <textarea
                            id="templateVersePath"
                            className="glass-input form-textarea"
                            value={templateVersePath}
                            onChange={(e) => setTemplateVersePath(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="glass-button glass-button-primary form-submit-button"
                    >
                        Criar Evento
                    </button>
                </form>
            </>
        </>
    );
};

