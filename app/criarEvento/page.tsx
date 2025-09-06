"use client"
import React, { useState } from 'react';
import ModalAction from "@/components/ModalAction";
import { IModalProps } from "@/components/ModalAction";

//
//
export default function Page() {
    return (
        <main className="flex items-center content-center justify-center h-svh bg-[#0B2545]">
            <div className="w-fit">
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
            <div className="w-full py-[40px] px-[20px] bg-white border-[5px] border-red-900">
                <h1 className="font-extrabold mb-4 text-center text-[20px] max-w-80 min-w-80 ">CRIAR EVENTO</h1>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="eventName" className="block text-sm font-extrabold text-gray-700">
                            Nome do Evento
                        </label>
                        <input
                            type="text"
                            id="eventName"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="eventDescription" className="block text-sm font-extrabold text-gray-700">
                            Descrição do Evento
                        </label>
                        <textarea
                            id="eventDescription"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border-black"
                            value={eventDescription}
                            onChange={(e) => setEventDescription(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="templatePath" className="block text-sm font-extrabold text-gray-700">
                            Template - Frente
                        </label>
                        <textarea
                            id="templatePath"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border-black"
                            value={templatePath}
                            onChange={(e) => setTemplatePath(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="templateVersePath" className="block text-sm font-extrabold text-gray-700">
                            Template - Verso <p className='text-[10px]'>Deixe em branco se não houver verso</p>
                        </label>
                        <textarea
                            id="templateVersePath"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border-black"
                            value={templateVersePath}
                            onChange={(e) => setTemplateVersePath(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Criar Evento
                    </button>
                </form>
            </div>
        </>
    );
};

