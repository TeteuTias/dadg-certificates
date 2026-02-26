"use client"

import Link from "next/link"
import React, { useState, useEffect } from "react"
import { IEventCertificate } from "@/lib/models/EventCertificateModel" // Ajuste o path se necessário
import { IModalProps } from "@/components/ModalActionWithTextVerification"
import { IModalProps as IModalPropsWithoutPhrase } from "@/components/ModalAction"
import ModalActionWithTextVerification from "@/components/ModalActionWithTextVerification"
import ModalAction from "@/components/ModalAction"
import { ObjectId } from "bson" // ou "mongodb" dependendo da sua stack
import { useRouter } from "next/navigation"
import LoadingModal from "@/components/LoadingModal"
import { libSourceSerif4 } from "@/public/fonts/lib/libSourceSerif4"
import { ICertificate, ICertificateWithEventPopulate } from "@/lib/models/CertificateModel"
import EventParticipant, { IEventParticipant } from "@/lib/models/EventParticipant"

export default function Home({ params }: { params: Promise<{ _id: string }> }) {
    const router = useRouter()
    const [paramsId, setParamsId] = useState<string>("")
    const [data, setData] = useState<IEventCertificate | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isEditing, setIsEditing] = useState<boolean>(false)
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [toggleOpenSubs, setToggleOpenSubs] = useState<boolean>(false)
    const [openEditor, setOpenEditor] = useState<boolean>(false)
    const toggleIsLoading = () => setIsLoading((prev) => !prev)
    const toggleOpenSubsHandler = () => setToggleOpenSubs((prev) => !prev)
    const toggleOpenEditor = () => setOpenEditor((prev) => !prev)

    const [ModalOpenPropsWithoutPhrase, setModalOpenPropsWithoutPhrase] = useState<IModalPropsWithoutPhrase & { isOpen: boolean }>({
        title: "Atenção", emoji: "", text: "", isOpen: false,
        buttons: [{ label: "", action: () => setModalOpenPropsWithoutPhrase((prev) => ({ ...prev, isOpen: false })) }]
    })

    const [modalOpenProps, setModalOpenProps] = useState<IModalProps & { isOpen: boolean }>({
        title: "", emoji: "", text: "", expectedPhrase: "",
        onConfirm: () => { }, onCancel: () => { }, isOpen: false
    })

    const toggleModalOpenPropsWithoutPhrase = (newState: Partial<IModalPropsWithoutPhrase & { isOpen: boolean }>) => {
        setModalOpenPropsWithoutPhrase((prev) => ({ ...prev, ...newState }))
    }

    const toggleModalOpenProps = (newState: Partial<IModalProps & { isOpen: boolean }>) => {
        setModalOpenProps((prev) => ({ ...prev, ...newState }))
    }

    // Estado abrangente para TODOS os campos
    const [formData, setFormData] = useState<any>({})
    const [originalFormData, setOriginalFormData] = useState<any>({})
    const [dirtyFields, setDirtyFields] = useState<Record<string, boolean>>({})

    useEffect(() => {
        const getData = async () => {
            const slug = (await params)._id
            setParamsId(slug)

            const response = await fetch(`/api/get/eventById/${slug}`)
            const dataJson: { data: IEventCertificate } = await response.json()
            const eventData = dataJson.data
            setData(eventData)

            // Formata os dados iniciais. Objetos complexos viram JSON para edição em textarea.
            const initialValues = {
                eventName: eventData.eventName || "",
                eventDescription: eventData.eventDescription || "",
                eventType: eventData.eventType || "",
                documentVersion: eventData.documentVersion || "",
                maxParticipants: eventData.maxParticipants || 0,
                registrationCount: eventData.registrationCount || 0,
                isOpen: eventData.isOpen ?? true,
                isPaid: eventData.isPaid ?? false,
                price: eventData.price || 0,
                templatePath: eventData.templatePath || "",
                templateVersePath: eventData.templateVersePath || "",
                // Objetos de Estilo viram Strings JSON
                styleContainer: JSON.stringify(eventData.styleContainer || {}, null, 2),
                styleContainerVerse: JSON.stringify(eventData.styleContainerVerse || {}, null, 2),
                styleFrontTopperText: JSON.stringify(eventData.styleFrontTopperText || {}, null, 2),
                styleFrontBottomText: JSON.stringify(eventData.styleFrontBottomText || {}, null, 2),
                styleNameText: JSON.stringify(eventData.styleNameText || {}, null, 2),
            }

            setFormData(initialValues)
            setOriginalFormData(initialValues)

            // Inicializa todos os dirtyFields como false
            const initialDirty: Record<string, boolean> = {}
            Object.keys(initialValues).forEach(key => { initialDirty[key] = false })
            setDirtyFields(initialDirty)

            setLoading(false)
        }
        getData()
    }, [params])

    // Handler universal que aceita texto, números e checkboxes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const name = target.name;
        let value: any = target.value;

        if (target.type === 'checkbox') {
            value = (target as HTMLInputElement).checked;
        } else if (target.type === 'number') {
            value = value === '' ? '' : Number(value);
        }

        setFormData((prev: any) => {
            const updated = { ...prev, [name]: value };
            // Se desmarcar 'isPaid', limpa o preço
            if (name === 'isPaid' && !value) {
                updated.price = 0;
                setDirtyFields(df => ({ ...df, price: updated.price !== originalFormData.price }));
            }
            return updated;
        });

        setDirtyFields((prev: any) => ({
            ...prev,
            [name]: value !== originalFormData[name as keyof typeof originalFormData]
        }))
    }

    const updateField = async (fieldName: string) => {
        const res = await fetch('/api/put/updateEvent/', {
            method: 'PUT',
            body: JSON.stringify({
                ...formData,
                _id: data?._id,
                styleContainer: JSON.parse(formData.styleContainer),
                styleContainerVerse: JSON.parse(formData.styleContainerVerse),
                styleFrontBottomText: JSON.parse(formData.styleFrontBottomText),
                styleFrontTopperText: JSON.parse(formData.styleFrontTopperText),
                styleNameText: JSON.parse(formData.styleNameText),
            })
        });

        const result = await res.json();
        if (result.success || res.ok) { // Ajuste conforme o retorno real da sua API
            alert(`Campo atualizado com sucesso!`);
            setOriginalFormData((prev: any) => ({ ...prev, [fieldName]: formData[fieldName] }));
            setDirtyFields((prev: any) => ({ ...prev, [fieldName]: false }));
            if (result.data) setData(result.data); // Atualiza a view se a API retornar o dado novo
        } else {
            alert(`Erro ao atualizar: ${result.message}`);
        }
    }

    const deleteEvent = async (eventId: ObjectId | null | undefined) => { /* ... (mantido igual) ... */ }

    if (loading || !data) return <main className="w-full h-screen flex items-center justify-center"><h1>C A R R E G A N D O</h1></main>

    // Helper para renderizar os campos de edição
    const renderEditField = (label: string, name: string, type: string = "text", isTextArea: boolean = false) => (
        <div className="flex flex-col mb-4 bg-gray-50 p-3 rounded border">
            <label className="font-semibold text-sm mb-1">{label}:</label>
            {type === 'checkbox' ? (
                <input type="checkbox" name={name} checked={formData[name]} onChange={handleInputChange} className="h-5 w-5" />
            ) : isTextArea ? (
                <textarea name={name} value={formData[name]} onChange={handleInputChange} className="border border-gray-300 rounded p-2 text-sm font-mono" rows={5} />
            ) : (
                <input type={type} name={name} value={formData[name]} onChange={handleInputChange} className="border border-gray-300 rounded p-2 text-sm" />
            )}

            {dirtyFields[name] && (
                <button type="button" onClick={() => updateField(name)} className="mt-2 py-1 px-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-sm">
                    Salvar Alteração
                </button>
            )}
        </div>
    )

    return (
        <main className="relative min-w-screen min-h-screen flex flex-col items-center justify-center bg-gray-200">
            {isLoading && <LoadingModal />}
            {ModalOpenPropsWithoutPhrase.isOpen && <ModalAction {...ModalOpenPropsWithoutPhrase} />}
            {modalOpenProps.isOpen && <ModalActionWithTextVerification {...modalOpenProps} />}
            <>
                {openEditor ? (
                    <CertificateEditor toggleOpenEditor={toggleOpenEditor} mockData={data} />
                ) : (
                    <div className="w-full max-w-2xl px-6 py-5 bg-white rounded-lg shadow-xl space-y-5">

                        {/* 1. VISÃO DE DETALHES (Só aparece se NÃO estiver editando) */}
                        {!isEditing && (
                            <>
                                <h2 className="text-2xl font-bold mb-6 text-center border-b pb-2">Detalhes do Evento</h2>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="col-span-2"><p className="text-gray-500 text-xs">ID Único</p><p className="font-mono">{String(data?._id)}</p></div>
                                    <div className="col-span-2"><p className="text-gray-500 text-xs">Nome</p><p className="font-bold text-lg">{data?.eventName}</p></div>
                                    <div className="col-span-2"><p className="text-gray-500 text-xs">Descrição</p><p>{data?.eventDescription}</p></div>

                                    <div><p className="text-gray-500 text-xs">Tipo</p><p>{data?.eventType || "Não definido"}</p></div>
                                    <div><p className="text-gray-500 text-xs">Versão</p><p>{data?.documentVersion || "Não definida"}</p></div>

                                    <div><p className="text-gray-500 text-xs">Participantes Máx.</p><p>{data?.maxParticipants || 0}</p></div>
                                    <div><p className="text-gray-500 text-xs">Inscritos Atuais</p><p>{data?.registrationCount || 0}</p></div>

                                    <div><p className="text-gray-500 text-xs">Status</p><p>{data?.isOpen ? "Aberto" : "Fechado"}</p></div>
                                    <div><p className="text-gray-500 text-xs">Pagamento</p><p>{data?.isPaid ? `Pago (R$ ${data?.price})` : "Grátis"}</p></div>
                                </div>

                                <div className="mt-4 flex flex-col gap-2">
                                    <Link href={`/todosCertificados/${paramsId}`} target="_blank" className="text-center p-3 bg-red-900 font-extrabold text-white rounded">
                                        Ver Certificados Do Evento
                                    </Link>
                                    <button onClick={() => setIsEditing(true)} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded">
                                        Configurações
                                    </button>
                                    <button onClick={toggleOpenEditor} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded">
                                        Modo de Edição
                                    </button>
                                    <button onClick={toggleOpenSubsHandler} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded">
                                        Ver Inscritos
                                    </button>
                                </div>
                            </>
                        )}

                        {/* 2. VISÃO DE EDIÇÃO (Só aparece se ESTIVER editando) */}
                        {isEditing && (
                            <form className="flex flex-col">
                                <div className="sticky top-0 bg-white pb-4 border-b mb-4 flex justify-between items-center z-10">
                                    <h2 className="text-xl font-bold text-red-800">Modo de Edição</h2>
                                    <button type="button" onClick={() => setIsEditing(false)} className="py-1 px-3 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded">
                                        Fechar Edição
                                    </button>
                                </div>

                                <h3 className="font-bold text-lg mb-2 text-blue-900">1. Informações Básicas</h3>
                                {renderEditField("Nome do Evento", "eventName")}
                                {renderEditField("Descrição", "eventDescription", "text", true)}

                                <h3 className="font-bold text-lg mt-4 mb-2 text-blue-900">2. Regras e Status</h3>
                                {renderEditField("Tipo de Evento", "eventType")}
                                {renderEditField("Versão do Doc", "documentVersion")}
                                {renderEditField("Máximo de Participantes", "maxParticipants", "number")}
                                {renderEditField("Quantidade de Inscritos (Manual)", "registrationCount", "number")}
                                {renderEditField("Evento Aberto?", "isOpen", "checkbox")}
                                {renderEditField("Evento Pago?", "isPaid", "checkbox")}
                                {formData?.isPaid && renderEditField("Preço (R$)", "price", "number")}

                                <h3 className="font-bold text-lg mt-4 mb-2 text-blue-900">3. Templates de Imagem</h3>
                                {renderEditField("Caminho do Template (Frente)", "templatePath")}
                                {renderEditField("Caminho do Template (Verso)", "templateVersePath")}

                                <h3 className="font-bold text-lg mt-4 mb-2 text-blue-900">4. Estilos (JSON)</h3>
                                <p className="text-xs text-red-600 mb-2">Aviso: Edite com cuidado. Requer formato JSON válido (ex: {`{"color": "red"}`}).</p>
                                {renderEditField("Style Container", "styleContainer", "text", true)}
                                {renderEditField("Style Container Verse", "styleContainerVerse", "text", true)}
                                {renderEditField("Style Front Topper Text", "styleFrontTopperText", "text", true)}
                                {renderEditField("Style Front Bottom Text", "styleFrontBottomText", "text", true)}
                                {renderEditField("Style Name Text", "styleNameText", "text", true)}
                            </form>
                        )}

                        {/* 3. MODAL DE INSCRITOS (Sobrepõe a tela graças ao "fixed inset-0") */}
                        {toggleOpenSubs && (
                            <EventParticipantsModal eventId={formData?._id} closeModal={toggleOpenSubsHandler} />
                        )}
                    </div>
                )}
            </>
        </main>
    )
}




function CertificateEditor({
    mockData,
    toggleOpenEditor
}: {
    mockData: any // Mantive any por enquanto para compatibilidade com seus testes, ou use IEventCertificate se já estiver tudo tipado
    toggleOpenEditor: () => void
}) {
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [data, setData] = useState<any>(null)

    // Estados para o MODO EDIÇÃO VISUAL
    const [isEditMode, setIsEditMode] = useState(true);

    // Estados para os ESTILOS
    const [liveStyles, setLiveStyles] = useState<any>({
        styleContainer: {},
        styleFrontTopperText: {},
        styleNameText: {},
        styleFrontBottomText: {},
        styleContainerVerse: {}
    });

    // --- NOVOS ESTADOS PARA O TEXTO DE TESTE ---
    const [liveTopperText, setLiveTopperText] = useState<string>("");
    const [liveBottomText, setLiveBottomText] = useState<string>("");

    useEffect(() => {
        setTimeout(() => {
            setData(mockData)
            setLiveStyles({
                styleContainer: mockData.styleContainer || {},
                styleFrontTopperText: mockData.styleFrontTopperText || {},
                styleNameText: mockData.styleNameText || {},
                styleFrontBottomText: mockData.styleFrontBottomText || {},
                styleContainerVerse: mockData.styleContainerVerse || {}
            })
            // Inicializa os textos com o que veio do mock
            setLiveTopperText(mockData.frontTopperText || "Certificamos que");
            setLiveBottomText(mockData.frontBottomText || "participou com êxito do evento organizado pela TechAcademy,\ndemonstrando excelente aproveitamento nas atividades propostas.");

            setIsLoading(false)
        }, 500);
    }, [mockData])

    const handleStyleChange = (section: string, cssProperty: string, value: string | number) => {
        setLiveStyles((prev: any) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [cssProperty]: value
            }
        }));
    };

    const saveEventStyles = async () => {
        console.log(data)
        const res = await fetch('/api/put/updateEvent/', {
            method: 'PUT',
            body: JSON.stringify({
                _id: data._id,
                ...liveStyles
            })
        });

        const result = await res.json();
        if (result.success || res.ok) { // Ajuste conforme o retorno real da sua API
            alert(`Campo atualizado com sucesso!`);
            window.location.reload();
        } else {
            alert(`Erro ao atualizar: ${result.message}`);
        }
    };

    if (isLoading) {
        return (
            <main className="relative flex flex-col max-w-screen overflow-hidden">
                <div className="fixed inset-0 flex items-center justify-center bg-[#09427D] bg-opacity-50">
                    <div className="bg-white p-6 rounded-md shadow-md"><p className="text-lg font-bold animate-pulse">CARREGANDO AMBIENTE DE TESTE...</p></div>
                </div>
            </main>
        )
    }

    // Helper para inputs de estilo
    const renderInput = (label: string, section: string, property: string, type: string = "text", placeholder: string = "") => (
        <div className="flex flex-col mb-2">
            <label className="text-xs font-bold text-gray-700">{label}</label>
            <input
                type={type}
                value={liveStyles[section][property] || ''}
                onChange={(e) => handleStyleChange(section, property, e.target.value)}
                placeholder={placeholder}
                className="border border-gray-300 rounded p-1 text-sm h-8 focus:ring focus:ring-blue-300"
            />
        </div>
    );

    // Helper exclusivo para os inputs de texto (conteúdo)
    const renderTextInput = (label: string, value: string, onChange: (val: string) => void, isTextArea: boolean = false) => (
        <div className="flex flex-col mb-2 col-span-2">
            <label className="text-xs font-bold text-blue-800">{label}</label>
            {isTextArea ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="border border-blue-300 rounded p-1 text-sm focus:ring focus:ring-blue-300 min-h-[60px]"
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="border border-blue-300 rounded p-1 text-sm h-8 focus:ring focus:ring-blue-300"
                />
            )}
        </div>
    );

    return (
        <>
            {/* PAINEL DE EDIÇÃO RENDERIZADO DIRETAMENTE */}
            {isEditMode && (
                <div className="fixed right-0 top-0 h-screen w-80 bg-gray-100 shadow-2xl border-l-4 border-blue-900 z-[9999] overflow-y-auto flex flex-col">
                    <div className="bg-blue-900 text-white p-4 sticky top-0 flex justify-between items-center shadow-md">
                        <h2 className="font-bold text-lg">Editor de Teste</h2>
                        <button onClick={() => toggleOpenEditor()} className="text-white hover:text-red-400 font-extrabold text-xl">&times;</button>
                    </div>

                    <div className="p-4 space-y-6 flex-1">
                        <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                            <h3 className="font-bold text-blue-900 border-b pb-1 mb-2">Posição Geral (Container)</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {renderInput("Largura", "styleContainer", "width", "text", "ex: 90%")}
                                {renderInput("Top (Y)", "styleContainer", "top", "text", "ex: -30px")}
                                {renderInput("Left (X)", "styleContainer", "left", "text", "ex: 55px")}
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                            <h3 className="font-bold text-blue-900 border-b pb-1 mb-2">Texto Superior</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {/* ADICIONADO CAMPO DE TEXTO AQUI */}
                                {renderTextInput("Testar Texto:", liveTopperText, setLiveTopperText)}
                                {renderInput("Tamanho", "styleFrontTopperText", "fontSize", "text", "ex: 50.5px")}
                                {renderInput("Cor", "styleFrontTopperText", "color", "color")}
                                {renderInput("Espaçamento", "styleFrontTopperText", "lineHeight", "text")}
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                            <h3 className="font-bold text-blue-900 border-b pb-1 mb-2">Nome do Aluno</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {renderInput("Tamanho", "styleNameText", "fontSize", "text", "ex: 55.5px")}
                                {renderInput("Cor", "styleNameText", "color", "color")}
                                {renderInput("Negrito", "styleNameText", "fontWeight", "text", "ex: 800")}
                            </div>
                        </div>

                        <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                            <h3 className="font-bold text-blue-900 border-b pb-1 mb-2">Texto Inferior</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {/* ADICIONADO CAMPO DE TEXTO AQUI (COMO TEXTAREA) */}
                                {renderTextInput("Testar Texto (aceita \\n):", liveBottomText, setLiveBottomText, true)}
                                {renderInput("Tamanho", "styleFrontBottomText", "fontSize", "text", "ex: 50.5px")}
                                {renderInput("Cor", "styleFrontBottomText", "color", "color")}
                                {renderInput("Espaçamento", "styleFrontBottomText", "lineHeight", "text")}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t border-gray-300 sticky bottom-0">
                        <button
                            onClick={saveEventStyles}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded shadow flex justify-center"
                        >
                            SALVAR
                        </button>
                    </div>
                </div>
            )}

            {/* ÁREA DO CERTIFICADO */}
            <article className={`relative flex justify-center w-full overflow-x-auto overflow-y-hidden transition-all duration-300 ${isEditMode ? 'pr-80' : ''}`}>
                <div className="relative my-10 flex-shrink-0" style={{ width: '900px', height: '636px' }}>
                    <div
                        id="frontCert"
                        className="absolute top-0 left-0 shadow-2xl origin-top-left"
                        style={{
                            width: '2000px',
                            height: '1414px',
                            transform: 'scale(0.45)',
                        }}
                    >
                        <img
                            src="https://www.dadg.com.br/api/get/templateProxy/698afa75b745573f14c27605|front?t=1771977431898"
                            alt="Certificado"
                            className="w-full h-full object-fill pointer-events-none opacity-80"
                        />

                        <div className="absolute top-[350px] -left-[125px] flex items-center justify-center content-center w-full">
                            <div className='w-[85%]'>
                                <div className="flex flex-col items-center justify-center font-bold space-y-5">
                                    <div className="relative flex flex-col space-y-5 items-center content-center justify-center w-full" style={{ ...liveStyles.styleContainer }}>

                                        {/* RENDERIZANDO O TEXTO AO VIVO */}
                                        <p style={{ ...libSourceSerif4?.style, ...liveStyles.styleFrontTopperText }}>
                                            {liveTopperText}
                                        </p>

                                        <p style={{ ...libSourceSerif4?.style, ...liveStyles.styleNameText }}>
                                            Nicolly Gozaga
                                        </p>

                                        <p className='font-thin'>
                                            Código de Verificação: {String(data?._id)}
                                        </p>

                                        {/* RENDERIZANDO O TEXTO AO VIVO COM QUEBRAS DE LINHA */}
                                        <p className='whitespace-pre-line' style={{ ...libSourceSerif4?.style, ...liveStyles.styleFrontBottomText, whiteSpace: 'pre-wrap' }}>
                                            {!liveBottomText ? "" :
                                                liveBottomText.replace(/\\n/g, "\n").split("\n").map((linha: string, indice: number) => (
                                                    <React.Fragment key={indice}>
                                                        {linha}
                                                        <br />
                                                    </React.Fragment>
                                                ))
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </>
    );
}
function EventParticipantsModal({ eventId, closeModal }: { eventId: string, closeModal: () => void }) {
    const [participants, setParticipants] = useState<IEventParticipant[] | null>(null)
    useEffect(() => {
        fetch(`/api/get/events/${eventId}/participants/`).then((res: Response) => res.json()).then((data: { data: IEventParticipant[] }) => {
            console.log("Participantes do evento:", data);
            setParticipants(data.data);
        })
    }, [eventId])
    return (
        <div className="fixed inset-0 bg-black bg-white flex items-center justify-center z-10">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4">Participantes Inscritos</h2>
                {!participants && <p>Carregando participantes...</p>}
                {participants && participants.length === 0 && <p>Nenhum participante inscrito.</p>}
                {participants && participants.length > 0 && (
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr>
                                <th className="border px-4 py-2">ID do Participante</th>
                                <th className="border px-4 py-2">Nome</th>
                                <th className="border px-4 py-2">Email</th>
                                <th className="border px-4 py-2">Data de Inscrição</th>
                            </tr>
                        </thead>
                        <tbody>
                            {participants.map((participant) => (
                                <tr key={`${participant._id}`}>
                                    <td className="border px-4 py-2 font-mono">{String(participant._id)}</td>
                                    <td className="border px-4 py-2">{participant.ownerName}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <button onClick={closeModal} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">
                    Fechar
                </button>
            </div>
        </div>
    )
}