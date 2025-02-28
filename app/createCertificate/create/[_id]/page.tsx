"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { IEventCertificate } from "@/lib/models/EventCertificateModel"
import { IModalProps } from "@/components/ModalActionWithTextVerification"
import { IModalProps as IModalPropsWithoutPhrase } from "@/components/ModalAction"
import ModalActionWithTextVerification from "@/components/ModalActionWithTextVerification"
import ModalAction from "@/components/ModalAction"
import { ObjectId } from "bson"
import { useRouter } from "next/navigation"
import LoadingModal from "@/components/LoadingModal"
import { ICertificate } from "@/lib/models/CertificateModel"

//
//
export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const router = useRouter()
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<IEventCertificate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState<boolean>(false)

    const toggleIsLoading = () => {
        setIsLoading((prev) => !prev)
    }

    const [ModalOpenPropsWithoutPhrase, setModalOpenPropsWithoutPhrase] = useState<IModalPropsWithoutPhrase & { isOpen: boolean }>({
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
    const [modalOpenProps, setModalOpenProps] = useState<IModalProps & { isOpen: boolean }>({
        title: "",
        emoji: "",
        text: "",
        expectedPhrase: "", // frase que o usuário deve digitar exatamente
        onConfirm: () => { },  // função a ser executada se a frase estiver correta
        onCancel: () => { },  // ação opcional para cancelar
        isOpen: false
    })

    const toggleModalOpenPropsWithoutPhrase = (newState: Partial<IModalPropsWithoutPhrase & { isOpen: boolean }>) => {
        setModalOpenPropsWithoutPhrase((prev) => ({ ...prev, ...newState }))
    }

    const toggleModalOpenProps = (newState: Partial<IModalProps & { isOpen: boolean }>) => {
        setModalOpenProps((prev) => ({ ...prev, ...newState }))
    }

    //

    const createCertificate = async (e: React.FormEvent) => {
        e.preventDefault()
        toggleModalOpenProps({
            isOpen: true,
            title: "Atenção",
            emoji: "",
            text: "Você está prestes a criar um novo certificado. Deseja continuar?",
            expectedPhrase: "Continuar", // frase que o usuário deve digitar exatamente
            onConfirm: async () => {
                toggleModalOpenProps({ isOpen: false })
                toggleIsLoading()
                const update = new FormData()
                update.append("eventId", String(data?._id))
                update.append("eventName", data?.eventName || "")
                update.append("ownerName", formData.ownerName)
                update.append("ownerEmail", formData.ownerEmail || "")
                update.append("ownerCpf", formData.ownerCpf || "")
                update.append("frontTopperText", formData.frontTopperText || "")
                update.append("frontBottomText", formData.frontBottomText || "")
                update.append("certificatePath", formData.certificatePath)
                update.append("certificateHours", formData.certificateHours)

                const fetchData = await fetch("/api/put/createNewCertificate", {
                    method: "PUT",
                    body: update
                })

                if (!fetchData.ok) {
                    const dataJson: { message: string } = await fetchData.json()
                    toggleIsLoading()
                    toggleModalOpenPropsWithoutPhrase({
                        text: dataJson.message.trim(),
                        title: "ERRO",
                        isOpen: true,
                        buttons: [
                            {
                                label: "Fechar",
                                action: () => toggleModalOpenPropsWithoutPhrase({ isOpen: false })
                            }
                        ]

                    })
                    return;
                }

                const dataJson: { _id: string } = await fetchData.json()
                toggleIsLoading()
                toggleModalOpenPropsWithoutPhrase({
                    title: "Sucesso! 🎉",
                    text: "Seu certificado foi criado com sucesso!",
                    isOpen: true,
                    buttons: [
                        {
                            label: "Ver certificado!",
                            action: () => router.push(`https://www.dadg.com.br/certificados/meuCertificado/${dataJson._id}`)
                        },
                        {
                            label: "Novo Certificado",
                            action: () => {
                                setFormData({
                                    ownerName: "",
                                    ownerCpf: "",
                                    ownerEmail: "",
                                    certificateHours: "",
                                    certificatePath: "/certificates/templates/template04.png",
                                    frontTopperText: "",
                                    frontBottomText: "",
                                })
                                toggleModalOpenPropsWithoutPhrase({ isOpen: false })
                            }
                        }
                    ]

                })

            },  // função a ser executada se a frase estiver correta
            onCancel: () => { toggleModalOpenProps({ isOpen: false }) },  // ação opcional para cancelar
        })
    }



    // Estado para os valores dos inputs
    const [formData, setFormData] = useState<Omit<ICertificate, "_id" | "eventId" | "eventName">>({
        ownerName: "",
        ownerCpf: "",
        ownerEmail: "",
        certificateHours: "",
        certificatePath: "/certificates/templates/template04.png",
        frontTopperText: "",
        frontBottomText: "",
    })

    // Estado para guardar os valores originais (para comparação)


    useEffect(() => {
        const getData = async () => {
            const slug = (await params)._id
            setParamsId(slug)

            const response = await fetch(`/api/get/eventById/${slug}`)
            const dataJson: { data: IEventCertificate } = await response.json()
            setData(dataJson.data)

            setLoading(false)
        }
        getData()
    }, [params])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        // Atualiza o estado do input
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Função para atualizar individualmente o campo alterado
    /*
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
    */


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
        <main className="relative min-h-screen flex flex-col items-center justify-center bg-gray-50">
            {
                isLoading &&
                <LoadingModal />
            }
            {
                ModalOpenPropsWithoutPhrase.isOpen &&
                <ModalAction {...ModalOpenPropsWithoutPhrase} />
            }
            {modalOpenProps.isOpen &&
                <ModalActionWithTextVerification {...modalOpenProps} />
            }
            {
                isEditing ?
                    <form
                        className="flex flex-col gap-4 border-blue-800 border-[2px] w-[30%] p-5 my-2"
                        onSubmit={createCertificate} // Adiciona validação ao formulário
                    >
                        <h2 className="text-2xl font-bold mb-4 text-center bg-red-800 text-white p-2 rounded">
                            Novo Certificado
                        </h2>

                        {/* Nome do Usuário */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Nome do Usuário</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerName"
                                value={formData.ownerName || ""} // Evita erro se for undefined
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* CPF */}
                        <div className="flex flex-col">
                            <label className="font-semibold">CPF</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="ownerCpf"
                                value={formData.ownerCpf || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Email */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Email de Usuário</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="email" // Usa "email" para validação automática
                                name="ownerEmail"
                                value={formData.ownerEmail || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Horas */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Horas</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="number" // Garante entrada numérica
                                name="certificateHours"
                                value={formData.certificateHours || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Path de Template */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Path de Template</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="certificatePath"
                                value={formData.certificatePath || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Texto Superior */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Texto Superior da Frente do Certificado</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontTopperText"
                                value={formData.frontTopperText || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Texto Inferior */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Texto Inferior da Frente do Certificado</label>
                            <input
                                required
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontBottomText"
                                value={formData.frontBottomText || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Botão de envio dentro do <form> */}
                        <button
                            type="submit" // Agora usa "submit" para acionar validações
                            className="mt-4 py-2 px-4 bg-red-500 hover:bg-red-600 font-extrabold text-white rounded-lg"
                        >
                            Criar Certificado
                        </button>
                        <div className="flex flex-col">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="mt-0 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                            >
                                Voltar
                            </button>
                        </div>
                    </form>
                    :
                    <div className="flex flex-col gap-4 border-blue-800 border-[2px] w-[30%] p-5 my-2">
                        <h2 className="text-2xl font-bold mb-6 text-center">Detalhes do Evento</h2>
                        <div className="">
                            <p><strong>Identificação Única</strong></p>
                            <p>{String(data?._id)}</p>
                        </div>
                        <div className="space-y-3">
                            <p><strong>Evento:</strong> {data?.eventName}</p>
                            <p><strong>Descrição:</strong> {data?.eventDescription}</p>
                        </div>
                        <Link
                            prefetch={false}
                            href={`/todosCertificados/${paramsId}`}
                            target="_blank"
                            className=""
                        >
                            <div className="mt-4 p-2 bg-red-900 font-extrabold text-white">
                                Ver Certificados Do Evento
                            </div>
                        </Link>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="mt-6 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                        >
                            Criar Certificado
                        </button>
                    </div>
            }
        </main>
    )
}
