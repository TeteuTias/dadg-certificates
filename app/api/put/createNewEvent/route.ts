import { NextResponse } from "next/server"
import CreateNewEvent from "@/lib/models/src/certificatesHandler/put/CreateNewEvent";
import { connectToDatabase } from "@/lib/mongodb";
import { EventStatusConfig, IEventCertificate, TimelineItem } from "@/lib/models/EventCertificateModel";

export async function PUT(request: Request) {
    const formData = await request.formData();

    // Configurando os campos do front
    const eventName = formData.get("eventName");
    const eventDescription = formData.get("eventDescription");
    const templatePath = formData.get("templatePath");
    const templateVersePath = formData.get("templateVersePath") as string;
    const eventType = formData.get("eventType");
    const maxParticipantsRaw = formData.get("maxParticipants");
    const isPaidRaw = formData.get("isPaid");
    const priceRaw = formData.get("price");

    // Pegando dados do status
    const statusRaw = formData.get("status") as string;
    const registrationStartDateRaw = formData.get("registrationStartDate") as string;
    const registrationEndDateRaw = formData.get("registrationEndDate") as string;
    const timeLineRaw = formData.get("timeLine") as string;

    // 1. Validações Básicas de Strings
    if (!templatePath || typeof templatePath !== "string") return NextResponse.json({ message: "Forneça o caminho do template." }, { status: 400 });
    if (!eventName || typeof eventName !== "string") return NextResponse.json({ message: "Forneça o nome do evento." }, { status: 400 });
    if (!eventDescription || typeof eventDescription !== "string") return NextResponse.json({ message: "Forneça a descrição do evento." }, { status: 400 });
    if (!eventType || typeof eventType !== "string") return NextResponse.json({ message: "Forneça o tipo do evento." }, { status: 400 });

    const maxParticipants = Number(maxParticipantsRaw);
    if (isNaN(maxParticipants) || maxParticipants <= 0) return NextResponse.json({ message: "Forneça uma quantidade máxima de participantes válida." }, { status: 400 });

    const isPaid = isPaidRaw === "true";
    let price: number | undefined = undefined;
    if (isPaid) {
        price = Number(priceRaw);
        if (isNaN(price) || price < 0) return NextResponse.json({ message: "O evento é pago, forneça um valor válido." }, { status: 400 });
    }

    // 2. Parseamento e Validação de Datas
    let registrationStartDate: Date | undefined = undefined;
    let registrationEndDate: Date | undefined = undefined;

    if (registrationStartDateRaw) {
        registrationStartDate = new Date(registrationStartDateRaw);
        if (isNaN(registrationStartDate.getTime())) return NextResponse.json({ message: "Data de início de registro inválida." }, { status: 400 });
    }

    if (registrationEndDateRaw) {
        registrationEndDate = new Date(registrationEndDateRaw);
        if (isNaN(registrationEndDate.getTime())) return NextResponse.json({ message: "Data de término de registro inválida." }, { status: 400 });
    }

    if (registrationStartDate && registrationEndDate && registrationStartDate >= registrationEndDate) {
        return NextResponse.json({ message: "A data de término deve ser posterior à data de início." }, { status: 400 });
    }

    // 3. Parseamento e Validação da Timeline
    let timeLine: TimelineItem[] = [];
    if (timeLineRaw) {
        try {
            const parsedTimeLine = JSON.parse(timeLineRaw);
            // Mapeando para garantir que as datas da timeline também sejam objetos Date válidos
            timeLine = parsedTimeLine.map((item: any) => ({
                ...item,
                startDate: new Date(item.startDate),
                endDate: new Date(item.endDate)
            }));
        } catch (error) {
            return NextResponse.json({ message: "Formato inválido para a linha do tempo." }, { status: 400 });
        }
    }

    // 4. Validação de Status e Montagem do statusDetails
    const listStatus: EventStatusConfig["status"][] = ["DRAFT", "PUBLISHED_OPEN", "PUBLISHED_CLOSED", "CERTIFICATE_ONLY"];
    if (!statusRaw || !listStatus.includes(statusRaw as EventStatusConfig["status"])) {
        return NextResponse.json({ message: "Forneça um status válido para o evento." }, { status: 400 });
    }

    const status = statusRaw as EventStatusConfig["status"];
    let statusDetails: EventStatusConfig;

    switch (status) {
        case "PUBLISHED_OPEN":
            if (!registrationStartDate || !registrationEndDate) {
                return NextResponse.json({ message: "Eventos PUBLISHED_OPEN exigem data de início e fim de inscrições." }, { status: 400 });
            }
            if (timeLine.length === 0) {
                return NextResponse.json({ message: "Eventos publicados exigem pelo menos um item na linha do tempo." }, { status: 400 });
            }
            statusDetails = {
                status: "PUBLISHED_OPEN",
                timeLine,
                registrationStartDate,
                registrationEndDate,
            };
            break;

        case "PUBLISHED_CLOSED":
        case "CERTIFICATE_ONLY":
            if (timeLine.length === 0) {
                return NextResponse.json({ message: "Eventos publicados/certificados exigem pelo menos um item na linha do tempo." }, { status: 400 });
            }
            statusDetails = {
                status: status,
                timeLine,
                // Mantém as datas se existirem, respeitando que são opcionais nesse caso
                registrationStartDate,
                registrationEndDate,
            };
            break;

        case "DRAFT":
            statusDetails = {
                status: "DRAFT",
                // Se o array de timeline estiver vazio, passamos undefined para respeitar o tipo
                timeLine: timeLine.length > 0 ? timeLine : undefined,
                registrationStartDate,
                registrationEndDate,
            };
            break;

        default:
            // Fallback de segurança (o TypeScript entende que nunca deve chegar aqui se todos os cases foram cobertos)
            return NextResponse.json({ message: "Status não mapeado" }, { status: 400 });
    }

    // 5. Fazendo o payload
    const baseEventData = {
        eventName: eventName,
        eventDescription: eventDescription,
        templatePath: templatePath,
        templateVersePath: templateVersePath || "",
        eventType: eventType,
        maxParticipants: maxParticipants,
        styleContainer: {
            "width": "90%", "top": "-30px", "left": "55px", "textAlign": "center", "color": "02425A"
        },
        styleFrontTopperText: {
            "lineHeight": 1.6, "fontSize": "50.5px", "fontWeight": "400", "color": "#02425A"
        },
        styleFrontBottomText: {
            "lineHeight": 1.6, "fontSize": "50.5px", "fontWeight": "400", "color": "#02325A"
        },
        styleNameText: {
            "fontSize": "55.5px", "fontWeight": "800", "lineHeight": 1.5, "color": "#02425A"
        },
        styleContainerVerse: {
            containerStyle: { border: "1.5px solid", width: "50%" },
            rowsStyle: { textAlign: "center", backgroundColor: "", padding: "25px", fontSize: "20px", border: "1.5px solid" },
            headerStyle: { fontSize: "25px", border: "1.5px solid", padding: "30px" }
        },
        registrationCount: 0,
        documentVersion: "3.0",
        useStatementFormat: false,
        statusDetails: statusDetails // <--- Aqui entra o objeto validado perfeitamente!
    };

    // 6. Aplicando o payload final (Lidando com os tipos do pagamento)
    const finalEventData = isPaid
        ? { ...baseEventData, isPaid: true as const, price: price! }
        : { ...baseEventData, isPaid: false as const };

    try {
        await connectToDatabase();
        await CreateNewEvent(finalEventData as any);

        return NextResponse.json({ message: "Evento adicionado com sucesso!" }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar evento:", error);
        return NextResponse.json({ message: "Erro interno ao salvar no banco de dados." }, { status: 500 });
    }
}