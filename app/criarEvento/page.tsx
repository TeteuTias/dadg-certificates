"use client"
import React, { useState } from 'react';
import ModalAction from "@/components/ModalAction";
import { IModalProps } from "@/components/ModalAction";
import "./page.css";

export default function Page() {
    return (
        <main className="flex items-center content-center justify-center min-h-svh bg-[#0B2545] py-10">
            <div className="w-fit">
                <CreateEventCertificateForm />
            </div>
        </main>
    )
}

const CreateEventCertificateForm: React.FC = () => {
    // Estados originais
    const [eventName, setEventName] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [templatePath, setTemplatePath] = useState('template04.png');
    const [templateVersePath, setTemplateVersePath] = useState('');

    // Novos estados (Informações Gerais e Regras)
    const [eventType, setEventType] = useState('');
    const [maxParticipants, setMaxParticipants] = useState<number | ''>('');
    const [isOpen, setIsOpen] = useState(true);
    const [isPaid, setIsPaid] = useState(false);
    const [price, setPrice] = useState<number | ''>('');

    const [modalOpenProps, setModalOpenProps] = useState<IModalProps & { isOpen: boolean }>({
        title: "Atenção",
        emoji: "",
        text: "Você está prestes a criar um Evento. Deseja continuar?",
        isOpen: false,
        buttons: [
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
        // Campos originais
        formData.append("eventName", eventName)
        formData.append("eventDescription", eventDescription)
        formData.append("templatePath", templatePath)
        formData.append("templateVersePath", templateVersePath)

        // Novos campos
        formData.append("eventType", eventType)
        formData.append("maxParticipants", maxParticipants.toString())
        formData.append("isOpen", isOpen.toString())
        formData.append("isPaid", isPaid.toString())

        // Adiciona o preço apenas se for pago
        if (isPaid && price !== '') {
            formData.append("price", price.toString())
        }

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
        setEventType('');
        setMaxParticipants('');
        setPrice('');
        setIsPaid(false);
        setIsOpen(true);
    };

    return (
        <>
            {
                modalOpenProps.isOpen &&
                <ModalAction {...modalOpenProps} />
            }
            <div className="w-full max-w-lg py-[40px] px-[20px] bg-white border-[5px] border-red-900 overflow-y-auto">
                <h1 className="font-extrabold mb-4 text-center text-[20px]">CRIAR EVENTO</h1>
                <form onSubmit={handleSubmit}>

                    {/* --- INFORMAÇÕES BÁSICAS --- */}
                    <h2 className="text-md font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3 mt-4">Informações Básicas</h2>

                    <div className="mb-4">
                        <label htmlFor="eventName" className="block text-sm font-extrabold text-gray-700">Nome do Evento</label>
                        <input type="text" id="eventName" required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                            value={eventName} onChange={(e) => setEventName(e.target.value)}
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="eventDescription" className="block text-sm font-extrabold text-gray-700">Descrição do Evento</label>
                        <textarea id="eventDescription" required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                            value={eventDescription} onChange={(e) => setEventDescription(e.target.value)}
                        />
                    </div>

                    {/* --- INFORMAÇÕES GERAIS E REGRAS --- */}
                    <h2 className="text-md font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3 mt-6">Regras e Detalhes</h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="eventType" className="block text-sm font-extrabold text-gray-700">Tipo de Evento</label>
                            <input type="text" id="eventType" required placeholder="Ex: Workshop, Palestra..."
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                                value={eventType} onChange={(e) => setEventType(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="maxParticipants" className="block text-sm font-extrabold text-gray-700">Qtd. Máx. de Participantes</label>
                        <input type="number" id="maxParticipants" required min="1"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                            value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value) || '')}
                        />
                    </div>

                    <div className="flex items-center gap-6 mb-4">
                        <div className="flex items-center">
                            <input type="checkbox" id="isOpen"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)}
                            />
                            <label htmlFor="isOpen" className="ml-2 block text-sm font-extrabold text-gray-700">
                                Abrir Inscrições?
                            </label>
                        </div>

                        <div className="flex items-center">
                            <input type="checkbox" id="isPaid"
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                checked={isPaid} onChange={(e) => {
                                    setIsPaid(e.target.checked);
                                    if (!e.target.checked) setPrice(''); // Limpa o preço se desmarcar
                                }}
                            />
                            <label htmlFor="isPaid" className="ml-2 block text-sm font-extrabold text-gray-700">
                                É Pago?
                            </label>
                        </div>
                    </div>

                    {/* Campo de Preço Condicional */}
                    {isPaid && (
                        <div className="mb-4 p-3 bg-gray-100 rounded-md border border-gray-200">
                            <label htmlFor="price" className="block text-sm font-extrabold text-gray-700">Valor do Evento (R$)</label>
                            <input type="number" id="price" required={isPaid} min="0" step="0.01"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                                value={price} onChange={(e) => setPrice(Number(e.target.value) || '')}
                            />
                        </div>
                    )}

                    {/* --- TEMPLATES --- */}
                    <h2 className="text-md font-bold text-gray-800 border-b border-gray-300 pb-1 mb-3 mt-6">Templates do Certificado</h2>

                    <div className="mb-4">
                        <label htmlFor="templatePath" className="block text-sm font-extrabold text-gray-700">Template - Frente</label>
                        <textarea id="templatePath" required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                            value={templatePath} onChange={(e) => setTemplatePath(e.target.value)}
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="templateVersePath" className="block text-sm font-extrabold text-gray-700">
                            Template - Verso <span className='text-[10px] font-normal text-gray-500'>(Deixe em branco se não houver verso)</span>
                        </label>
                        <textarea id="templateVersePath"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border border-gray-400 p-2"
                            value={templateVersePath} onChange={(e) => setTemplateVersePath(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 transition-colors">
                        Criar Evento
                    </button>
                </form>
            </div>
        </>
    );
};