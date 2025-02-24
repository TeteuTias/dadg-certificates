"use client"

import { useState, useEffect } from "react"
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel"

export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<ICertificateWithEventPopulate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)
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

    useEffect(() => {
        const getData = async () => {
            const slug = (await params)._id
            setParamsId(slug)

            const response = await fetch(`/api/get/CertificateWithPopulateByEvent/${slug}`)
            const dataJson: { data: ICertificateWithEventPopulate } = await response.json()
            setData(dataJson.data)

            // Preenche os campos do formulário com os dados retornados
            setFormData({
                ownerName: dataJson.data.ownerName,
                ownerCpf: dataJson.data.ownerCpf || "",
                eventName: dataJson.data.eventName,
                ownerEmail: dataJson.data.ownerEmail || "",
                certificateHours: dataJson.data.certificateHours,
                certificatePath: dataJson.data.certificatePath,
                frontTopperText: dataJson.data.frontTopperText || "",
                frontBottomText: dataJson.data.frontBottomText || ""
            })

            setLoading(false)
        }
        getData()
    }, [params])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const res = await fetch('/api/certificate/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: paramsId,
                ...formData
            })
        })
        const result = await res.json()
        if (result.success) {
            alert('Certificado atualizado com sucesso!')
            setData(result.data)
            setIsEditing(false)
        } else {
            alert('Erro ao atualizar o certificado: ' + result.message)
        }
    }

    if (loading) {
        return (
            <main className="w-full h-svh flex items-center justify-center">
                <div>
                    <h1>C A R R E G A N D O</h1>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50">
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
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <h2 className="text-2xl font-bold mb-4 text-center bg-red-800">Editar Certificado</h2>
                        <label className="flex flex-col">
                            Nome do Proprietário:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerName"
                                value={formData.ownerName}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            CPF do Proprietário:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerCpf"
                                value={formData.ownerCpf}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            Nome do Evento:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="eventName"
                                value={formData.eventName}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            E-mail:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="email"
                                name="ownerEmail"
                                value={formData.ownerEmail}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            Horas do Certificado:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="certificateHours"
                                value={formData.certificateHours}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            Caminho do Certificado:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="certificatePath"
                                value={formData.certificatePath}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            Texto Superior:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontTopperText"
                                value={formData.frontTopperText}
                                onChange={handleInputChange}
                            />
                        </label>
                        <label className="flex flex-col">
                            Texto Inferior:
                            <input
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontBottomText"
                                value={formData.frontBottomText}
                                onChange={handleInputChange}
                            />
                        </label>
                        <div className="flex gap-4 mt-4">
                            <button
                                type="submit"
                                className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                            >
                                Salvar Alterações
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </main>

    )
}
