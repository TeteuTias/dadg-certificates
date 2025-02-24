"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel"

export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<ICertificateWithEventPopulate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)

    // Estado para os valores dos inputs
    const [formData, setFormData] = useState({
        ownerName: "",
        ownerCpf: "",
        eventName: "",
        ownerEmail: "",
        certificateHours: "",
        certificatePath: "",
        frontTopperText: "",
        frontBottomText: ""
    })

    // Estado para guardar os valores originais (para comparação)
    const [originalFormData, setOriginalFormData] = useState(formData)

    // Estado para controlar quais campos foram modificados
    const [dirtyFields, setDirtyFields] = useState({
        ownerName: false,
        ownerCpf: false,
        eventName: false,
        ownerEmail: false,
        certificateHours: false,
        certificatePath: false,
        frontTopperText: false,
        frontBottomText: false,
    })

    useEffect(() => {
        const getData = async () => {
            const slug = (await params)._id
            setParamsId(slug)

            const response = await fetch(`/api/get/CertificateWithPopulateByEvent/${slug}`)
            const dataJson: { data: ICertificateWithEventPopulate } = await response.json()
            setData(dataJson.data)

            // Define os valores iniciais para formData e originalFormData
            const initialValues = {
                ownerName: dataJson.data.ownerName,
                ownerCpf: dataJson.data.ownerCpf || "",
                eventName: dataJson.data.eventName,
                ownerEmail: dataJson.data.ownerEmail || "",
                certificateHours: dataJson.data.certificateHours,
                certificatePath: dataJson.data.certificatePath,
                frontTopperText: dataJson.data.frontTopperText || "",
                frontBottomText: dataJson.data.frontBottomText || ""
            }
            setFormData(initialValues)
            setOriginalFormData(initialValues)

            setLoading(false)
        }
        getData()
    }, [params])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
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
        const res = await fetch('/api/put/updateCertificate/', {
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
                <button
                    type="button"
                    className="mt-4 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg w-full"
                >
                    <Link href={`https://www.dadg.com.br/certificados/meuCertificado/${paramsId}`} prefetch={true} target="_blank">
                        Ver Certificado
                    </Link>
                </button>
            </div>
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                {!isEditing ? (
                    <>
                        <h2 className="text-2xl font-bold mb-6 text-center">Detalhes do Certificado</h2>
                        <div className="space-y-3">
                            <p><strong>Evento:</strong> {data?.eventName}</p>
                            <p><strong>Nome do Proprietário:</strong> {data?.ownerName}</p>
                            <p><strong>CPF do Proprietário:</strong> {data?.ownerCpf}</p>
                            <p><strong>E-mail:</strong> {data?.ownerEmail}</p>
                            <p><strong>Horas do Certificado:</strong> {data?.certificateHours}</p>
                            <p><strong>Caminho do Certificado:</strong> {data?.certificatePath}</p>
                            <p><strong>Texto Superior:</strong> {data?.frontTopperText}</p>
                            <p><strong>Texto Inferior:</strong> {data?.frontBottomText}</p>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="mt-6 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                        >
                            Editar Certificado
                        </button>
                    </>
                ) : (
                    <form className="flex flex-col gap-4">
                        <h2 className="text-2xl font-bold mb-4 text-center bg-red-800 text-white p-2 rounded">
                            Editar Certificado
                        </h2>

                        {/* Exemplo para o campo "ownerName" */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Nome do Proprietário:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerName"
                                value={formData.ownerName}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.ownerName && (
                                <button
                                    type="button"
                                    onClick={() => updateField("ownerName")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: ownerCpf */}
                        <div className="flex flex-col">
                            <label className="font-semibold">CPF do Proprietário:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerCpf"
                                value={formData.ownerCpf}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.ownerCpf && (
                                <button
                                    type="button"
                                    onClick={() => updateField("ownerCpf")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: eventName */}
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

                        {/* Campo: ownerEmail */}
                        <div className="flex flex-col">
                            <label className="font-semibold">E-mail:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="email"
                                name="ownerEmail"
                                value={formData.ownerEmail}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.ownerEmail && (
                                <button
                                    type="button"
                                    onClick={() => updateField("ownerEmail")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: certificateHours */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Horas do Certificado:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="certificateHours"
                                value={formData.certificateHours}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.certificateHours && (
                                <button
                                    type="button"
                                    onClick={() => updateField("certificateHours")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: certificatePath */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Caminho do Certificado:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="certificatePath"
                                value={formData.certificatePath}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.certificatePath && (
                                <button
                                    type="button"
                                    onClick={() => updateField("certificatePath")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: frontTopperText */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Texto Superior:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontTopperText"
                                value={formData.frontTopperText}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.frontTopperText && (
                                <button
                                    type="button"
                                    onClick={() => updateField("frontTopperText")}
                                    className="mt-2 py-1 px-2 bg-green-500 hover:bg-green-600 text-white rounded"
                                >
                                    Salvar Alterações
                                </button>
                            )}
                        </div>

                        {/* Campo: frontBottomText */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Texto Inferior:</label>
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontBottomText"
                                value={formData.frontBottomText}
                                onChange={handleInputChange}
                            />
                            {dirtyFields.frontBottomText && (
                                <button
                                    type="button"
                                    onClick={() => updateField("frontBottomText")}
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
