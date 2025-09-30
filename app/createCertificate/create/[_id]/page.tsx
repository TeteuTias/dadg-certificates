"use client"

import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { IEventCertificate } from "@/lib/models/EventCertificateModel"
import { IModalProps } from "@/components/ModalActionWithTextVerification"
import { IModalProps as IModalPropsWithoutPhrase } from "@/components/ModalAction"
import ModalActionWithTextVerification from "@/components/ModalActionWithTextVerification"
import ModalAction from "@/components/ModalAction"

import { useRouter } from "next/navigation"
import LoadingModal from "@/components/LoadingModal"
import { ICertificate } from "@/lib/models/CertificateModel"
import * as XLSX from 'xlsx';
//
//
export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const router = useRouter()
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<IEventCertificate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const [isCreatingManyCertificates, setIsCreatingManyCertificates] = useState<boolean>(false)
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
                update.append("certificatePath", formData.certificatePath || "")
                update.append("certificateHours", formData.certificateHours)
                update.append("isReady", String(formData?.isReady))

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
                                    certificatePath: "",
                                    frontTopperText: "",
                                    frontBottomText: "",
                                    isReady: false
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
    const [formData, setFormData] = useState<Omit<ICertificate, "_id" | "eventId" | "eventName" | "verse">>({
        ownerName: "",
        ownerCpf: "",
        ownerEmail: "",
        certificateHours: "",
        certificatePath: "",
        frontTopperText: "",
        frontBottomText: "",
        isReady: false
    })
    const toggleCertificatePath = (text: string) => {
        setFormData(prev => ({
            ...prev,
            certificatePath: text
        }))
    }
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

    if (loading || !data) {
        return (
            <main className="w-full h-screen flex items-center justify-center">
                <div>
                    <h1>C A R R E G A N D O</h1>
                </div>
            </main>
        )
    }
    if (isCreatingManyCertificates) {
        return (
            <main className="relative min-h-screen flex flex-col items-center justify-center justify-center bg-gray-50">
                <div className="border-blue-800 border-[2px] p-5 my-2 space-y-10">
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-center">Criar Vários Certificados</h2>
                    </div>
                    <XLSXReader eventId={paramsId} eventName={data?.eventName} />
                    <div className="flex flex-col">
                        <button
                            onClick={() => {
                                setIsCreatingManyCertificates(false)
                                setIsEditing(false)
                            }
                            }
                            className="mt-0 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                        >
                            Voltar
                        </button>
                    </div>
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
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="number" // Garante entrada numérica
                                name="certificateHours"
                                value={formData.certificateHours || ""}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Path de Template */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Adicionar Foto/Pdf de Certificado</label>
                            <div className="flex flex-col space-x-2 items-center justify-center">
                                <input
                                    className="w-full mt-1 border border-gray-300 rounded p-2"
                                    type="text"
                                    name="certificatePath"
                                    value={formData.certificatePath || ""}
                                    onChange={handleInputChange}
                                />
                                <FileUploader toggleText={toggleCertificatePath} />
                            </div>
                        </div>

                        {/* Texto Superior */}
                        <div className="flex flex-col">
                            <label className="font-semibold">Texto Superior da Frente do Certificado</label>
                            <input
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
                                className="mt-1 border border-gray-300 rounded p-2"
                                type="text"
                                name="frontBottomText"
                                value={formData.frontBottomText || ""}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div>
                            <p className="font-bold">Liberar Certificado ?</p>
                            <div className="flex w-full justify-around">
                                <a onClick={() => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        isReady: true
                                    }))
                                }} className="cursor-pointer px-5 font-extrabold text-white" style={{
                                    backgroundColor: formData.isReady === true ? "blue" : "gray"
                                }}>SIM</a>
                                <a onClick={() => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        isReady: false
                                    }))
                                }} className="cursor-pointer px-5 font-extrabold text-white" style={{
                                    backgroundColor: formData.isReady === false ? "blue" : "gray"
                                }}>NÃO</a>
                            </div>
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
                        <div className="">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="mt-6 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                            >
                                Criar UM Certificado
                            </button>
                            <button
                                onClick={() => setIsCreatingManyCertificates(true)}
                                className="mt-6 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                            >
                                Criar Vários Certificados
                            </button>
                        </div>
                    </div>
            }
        </main>
    )
}
const XLSXReader: React.FC<{ eventId: string, eventName: string }> = ({ eventId, eventName }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [data, setData] = useState<string[][]>([]);
    const [subStep, setSubStep] = useState<0 | 1>(0)
    const [input1, setInput1] = useState<string>('');
    const [input2, setInput2] = useState<string>('');
    const [input3, setInput3] = useState<string>('');
    const [input4, setInput4] = useState<string>('');
    const [isReady, setIsReady] = useState<boolean>(false)

    const handleInput1Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput1(event.target.value);
    };

    const handleInput2Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput2(event.target.value);
    };
    const handleInput3Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput3(event.target.value);
    };
    const handleInput4Change = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInput4(event.target.value);
    };

    const processFile = (file: File) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const arrayBuffer = e.target?.result;
            if (arrayBuffer && typeof arrayBuffer !== 'string') {
                // Lê o arquivo e converte para um workbook
                const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                // Seleciona a primeira aba (pode ser alterado conforme necessário)
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Converte a planilha para um array de arrays
                const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                setData(jsonData);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const toggleSubStep = (newState: 0 | 1) => {
        setSubStep(newState)
    }

    const handleCellChange = (rowIndex: number, cellIndex: number, value: string) => {
        const newData = data.map((row, rIdx) => {
            if (rIdx === rowIndex) {
                return row.map((cell, cIdx) => {
                    return cIdx === cellIndex ? value : cell;
                });
            }
            return row;
        });
        setData(newData);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const pushCertificates = async () => {
        const fetchData = await fetch("/api/put/createManyCertificates", {
            method: "POST",
            body: JSON.stringify({
                update: data.filter((element) => element.length !== 0).filter((_, index) => index !== 0),
                frontText: input1,
                bottomText: input2,
                eventName: eventName,
                eventId: eventId,
                hours: input3,
                isReady: String(isReady),
                path: input4,
            })
        })
        if (!fetchData.ok) {
            const dataJson: { message: string } = await fetchData.json()
            alert(dataJson.message)
            return;
        }
        const dataJson: { message: string } = await fetchData.json()
        alert(dataJson.message)
        setSubStep(0)
        setData([])
        setInput1("")
        setInput2("")
        setInput3("")
        setInput4("")
    }

    return (
        <div className="overflow-auto w-[700px]">
            {
                subStep === 0 && (
                    <>
                        {
                            !data.length ? (
                                <div className="flex flex-col items-center justify-center space-y-5 ">
                                    <h2 className="w-full text-center">Selecione uma planilha no formato <span className="font-bold">XLSX</span>.</h2>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        className="flex flex-col w-full bg-yellow-100"
                                        style={{
                                            width: '300px',
                                            height: '200px',
                                            border: '2px dashed #ccc',
                                            marginTop: '20px',
                                            textAlign: 'center',
                                            lineHeight: '200px'
                                        }}
                                    >
                                        Arraste e solte o arquivo aqui
                                    </div>
                                </div>
                            )
                                : undefined
                        }

                        {data.length > 0 && (
                            <div style={{ marginTop: '20px' }} className="w-full">
                                <h3 className="w-full text-center font-extrabold underline" onClick={() => console.log(data)}>Conteúdo da Planilha</h3>
                                <table border={1} className="w-full">
                                    <tbody>
                                        {data.map((row, rowIndex) => (
                                            row.length ? (
                                                <tr key={rowIndex}
                                                    className="font-extrabold"
                                                    style={{
                                                        backgroundColor: `${rowIndex === 0 ? "brown" : rowIndex % 2 ? "#d9b0ad" : ""}`,
                                                        color: `${rowIndex === 0 ? "white" : "black"}`
                                                    }}>
                                                    {row.map((cell, cellIndex) => (
                                                        rowIndex === 0 ? (
                                                            <td key={cellIndex}>{cell || "none"}</td>
                                                        ) : (
                                                            <td key={cellIndex}>
                                                                <input
                                                                    type="text"
                                                                    value={cell}
                                                                    onChange={(e) =>
                                                                        handleCellChange(
                                                                            rowIndex,
                                                                            cellIndex,
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="p-1"
                                                                    style={{ backgroundColor: 'transparent' }}
                                                                />
                                                            </td>
                                                        )
                                                    ))}
                                                </tr>
                                            ) : undefined
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex flex-col space-y-4">
                                    <div className="w-full h-[5px] bg-red-800" />
                                    <div className="flex flex-row space-x-2">
                                        <button className="bg-red-800 w-fit font-white px-2 font-extrabold text-white" onClick={() => toggleSubStep(1)}>Próximo</button>
                                        <div>
                                            <button className="bg-red-800 w-fit font-white px-2 font-extrabold text-white" onClick={() => setData([])}>Fechar Planilha</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )
            }
            {
                subStep === 1 && (
                    <div>
                        <div>
                            <div>
                                <h1>Forneça o Texto Superior</h1>
                                <input
                                    id="input1"
                                    type="text"
                                    className="w-full"
                                    value={input1}
                                    onChange={handleInput1Change}
                                    placeholder="Forneça o texto superior."
                                />
                            </div>
                            <div>
                                <h1>Forneça o Texto Inferior</h1>
                                <input
                                    id="input2"
                                    type="text"
                                    className="w-full"
                                    value={input2}
                                    onChange={handleInput2Change}
                                    placeholder="Forneça o texto inferior"
                                />
                            </div>
                            <div>
                                <h1>Forneça a Quantidade de Horas</h1>
                                <input
                                    id="input3"
                                    type="text"
                                    className="w-full"
                                    value={input3}
                                    onChange={handleInput3Change}
                                    placeholder="Horas"
                                />
                            </div>
                            <div>
                                <h1>Path do Certificado</h1>
                                <input
                                    id="input4"
                                    type="text"
                                    className="w-full"
                                    value={input4}
                                    onChange={handleInput4Change}
                                    placeholder="Path"
                                />
                            </div>
                        </div>
                        <div>
                            <p className="">Bloquear Certificado ?</p>
                            <div className="flex w-full justify-around">
                                <a onClick={() => {
                                    setIsReady(true)
                                }} className="cursor-pointer px-5 font-extrabold text-white" style={{
                                    backgroundColor: isReady === true ? "blue" : "gray"
                                }}>SIM</a>
                                <a onClick={() => {
                                    setIsReady(false)
                                }} className="cursor-pointer px-5 font-extrabold text-white" style={{
                                    backgroundColor: isReady === false ? "blue" : "gray"
                                }}>NÃO</a>
                            </div>
                        </div>
                        <div className="flex flex-col space-y-4">
                            <div className="w-full h-[5px] bg-red-800" />
                            <div className="flex flex-row space-x-2">
                                <button className="bg-red-800 w-fit font-white px-2 font-extrabold text-white" onClick={() => toggleSubStep(0)}>Voltar</button>
                                <div>
                                    <button className="bg-red-800 w-fit font-white px-2 font-extrabold text-white" onClick={pushCertificates}>Criar Certificados</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}






function FileUploader({ toggleText }: { toggleText: (text: string) => void }) {
    // Tipando as referências e estados com TypeScript
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'initial' | 'selecting' | 'selected' | 'uploading' | 'success' | 'error'>('initial');
    const [feedbackMessage, setFeedbackMessage] = useState('');

    const handleDivClick = () => {
        setStatus('selecting');
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setStatus('selected');
            setFeedbackMessage(`Arquivo selecionado: ${file.name}`);
        } else {
            setStatus('initial');
        }
        event.target.value = '';
    };

    // --- Função de Upload ATUALIZADA para usar fetch ---
    const handleUpload = async () => {
        if (!selectedFile) {
            setFeedbackMessage('Nenhum arquivo selecionado.');
            setStatus('error');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        setStatus('uploading');
        setFeedbackMessage('Enviando...');

        try {
            const response = await fetch('/api/put/uploadCertificateTemplate', {
                method: 'POST',
                body: formData,
                // NÃO é necessário definir o header 'Content-Type'. 
                // O navegador faz isso automaticamente para FormData, incluindo o 'boundary' correto.
            });

            const jsonData: { fileId: string, message: string } = await response.json();

            if (!response.ok) {
                // Se a resposta não for bem-sucedida (status 4xx ou 5xx), lança um erro
                throw new Error('Falha no upload do arquivo.');
            }
            console.log(jsonData)
            toggleText(`${jsonData.fileId}`);
            setStatus('success');
            setFeedbackMessage(`Selecionado com Sucesso!`);
            setSelectedFile(null);

        } catch (error) {
            console.error('Erro no upload:', error);
            setStatus('error');
            // Tratamento para exibir a mensagem de erro corretamente
            const errorMessage = error instanceof Error ? error.message : 'Verifique o console para mais detalhes.';
            setFeedbackMessage(`Falha no upload. ${errorMessage}`);
        }
    };

    return (
        <div className="max-w-md mx-auto p-4 border rounded-lg shadow-lg">
            <div
                className="p-5 bg-red-600 text-white font-bold text-center cursor-pointer rounded-md hover:bg-red-700 transition-colors"
                onClick={handleDivClick}
            >
                Escolher Arquivo
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/*,.pdf"
            />

            {status !== 'initial' && status !== 'selecting' && (
                <div className="mt-4 text-center">
                    <p className="text-gray-600 truncate">{feedbackMessage}</p>
                    {status === 'selected' && (
                        <button
                            onClick={handleUpload}
                            className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            Enviar Arquivo
                        </button>
                    )}
                    {status === 'uploading' && <p className="text-blue-500">Aguarde...</p>}
                </div>
            )}
        </div>
    );
}