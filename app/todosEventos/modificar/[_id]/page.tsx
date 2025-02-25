"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { IEventCertificate } from "@/lib/models/EventCertificateModel"
import { eventNames } from "process"

export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<IEventCertificate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)

    // Estado para os valores dos inputs
    const [formData, setFormData] = useState({
        eventName: "",
        eventDescription: "",
    })

    // Estado para guardar os valores originais (para comparação)
    const [originalFormData, setOriginalFormData] = useState(formData)

    // Estado para controlar quais campos foram modificados
    const [dirtyFields, setDirtyFields] = useState({
        eventName: false,
        eventDescription: false,

    })

    useEffect(() => {
        const getData = async () => {
            const slug = (await params)._id
            setParamsId(slug)

            const response = await fetch(`/api/get/eventById/${slug}`)
            const dataJson: { data: IEventCertificate } = await response.json()
            setData(dataJson.data)

            // Define os valores iniciais para formData e originalFormData
            const initialValues = {
                eventName: dataJson.data.eventName,
                eventDescription: dataJson.data.eventDescription,
                /*
                ownerName: dataJson.data.ownerName,
                ownerCpf: dataJson.data.ownerCpf || "",
                eventName: dataJson.data.eventName,
                ownerEmail: dataJson.data.ownerEmail || "",
                certificateHours: dataJson.data.certificateHours,
                certificatePath: dataJson.data.certificatePath,
                frontTopperText: dataJson.data.frontTopperText || "",
                frontBottomText: dataJson.data.frontBottomText || ""
                */
            }
            setFormData(initialValues)
            setOriginalFormData(initialValues)

            setLoading(false)
        }
        getData()
    }, [params])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        console.log(name)
        // Atualiza o estado do input
        setFormData(prev => ({ ...prev, [name]: value }))
        // Compara com o valor original para definir se o campo está "dirty"
        setDirtyFields(prev => ({
            ...prev,
            [name]: value !== originalFormData[name as keyof typeof originalFormData]
        }))
    }

    // Função para atualizar individualmente o campo alterado
    const updateField = async (fieldName: string) => {
        // Cria uma instância de FormData e adiciona o ID e o campo alterado
        const formDataToSend = new FormData();
        formDataToSend.append('_id', paramsId);
        formDataToSend.append(fieldName, formData[fieldName as keyof typeof formData]);

        // Envia a requisição usando FormData
        const res = await fetch('/api/put/updateEvent/', {
            method: 'PUT',
            body: formDataToSend
        });

        const result = await res.json();
        if (result.success) {
            alert(`Campo ${fieldName} atualizado com sucesso!`);
            // Atualiza o valor original do campo para o novo valor
            setOriginalFormData(prev => ({
                ...prev,
                [fieldName]: formData[fieldName as keyof typeof formData]
            }));
            // Marca o campo como não alterado (dirty = false)
            setDirtyFields(prev => ({
                ...prev,
                [fieldName]: false
            }));
            // Atualiza o estado global (opcional, se a API retornar o objeto atualizado)
            setData(result.data);
        } else {
            alert(`Erro ao atualizar ${fieldName}: ${result.message}`);
        }
    }


    if (loading) {
        return (
            <main className="w-full h-screen flex items-center justify-center">
                <div>
                    <h1>C A R R E G A N D O</h1>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 ">
            <div className="w-full max-w-md ">
            </div>
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                {!isEditing ? (
                    <>
                        <h2 className="text-2xl font-bold mb-6 text-center">Detalhes do Certificado</h2>
                        <div className="">
                            <p><strong>Identificação Única</strong></p>
                            <p>{String(data?._id)}</p>
                        </div>
                        <div className="space-y-3">
                            <p><strong>Evento:</strong> {data?.eventName}</p>
                            <p><strong>Descrição:</strong> {data?.eventDescription}</p>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="mt-6 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                        >
                            Editar Evento
                        </button>
                    </>
                ) : (
                    <form className="flex flex-col gap-4">
                        <h2 className="text-2xl font-bold mb-4 text-center bg-red-800 text-white p-2 rounded">
                            Editar Evento
                        </h2>

                        {/* Exemplo para o campo "ownerName" */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Nome do Evento:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="eventName"
                                value={formData.eventName}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.eventName && (
                                <button
                                    type="button"
                                    onClick={() => updateField("eventName")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: ownerCpf */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Descrição:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="eventDescription"
                                value={formData.eventDescription}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.eventDescription && (
                                <button
                                    type="button"
                                    onClick={() => updateField("eventDescription")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="mt-4 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
                        >
                            Fechar Edição
                        </button>
                    </form>
                )}
            </div>
        </main>
    )
}
