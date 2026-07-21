import { NextResponse } from "next/server"
import CreateNewEvent from "@/lib/models/src/certificatesHandler/put/CreateNewEvent";
import { connectToDatabase } from "@/lib/mongodb";
import type { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { buildEventStatusDetails } from "@/lib/events/statusDetails";

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
    const statusDetailsResult = buildEventStatusDetails({
        status: statusRaw,
        registrationStartDate: registrationStartDateRaw,
        registrationEndDate: registrationEndDateRaw,
        timeLine: timeLineRaw,
    });

    if ("error" in statusDetailsResult) {
        return NextResponse.json({ message: statusDetailsResult.error }, { status: 400 });
    }

    const { statusDetails } = statusDetailsResult;

    // 5. Fazendo o payload
    const baseEventData = {
        eventName: eventName,
        eventDescription: eventDescription,
        templatePath: templatePath,
        templateVersePath: templateVersePath || "",
        eventType: eventType,
        maxParticipants: maxParticipants,
        styleContainer: {
            width: "90%",
            top: "-30px",
            left: "55px",
            textAlign: "center" as const,
            color: "#02425A"
        },
        styleFrontTopperText: {
            lineHeight: 1.6,
            fontSize: "45.0px",
            fontWeight: "400",
            color: "#02425A"
        },
        styleFrontBottomText: {
            lineHeight: 1.6,
            fontSize: "45.0px",
            fontWeight: "400",
            color: "#02325A"
        },
        styleNameText: {
            fontSize: "55.5px",
            fontWeight: "800",
            lineHeight: 1.5,
            color: "#02425A"
        },
        styleContainerVerse: {
            containerStyle: { border: "1.5px solid", width: "50%", color: "#02425A" },
            rowsStyle: { textAlign: "center" as const, backgroundColor: "", padding: "25px", fontSize: "20px", border: "1.5px solid" },
            headerStyle: { fontSize: "25px", border: "1.5px solid", padding: "30px" }
        },
        registrationCount: 0,
        documentVersion: "3.0",
        useStatementFormat: false,
        certificateHours: "",
        certificateReleased: false,
        statusDetails
    };

    // 6. Aplicando o payload final (Lidando com os tipos do pagamento)
    const finalEventData: Omit<IEventCertificate, "_id"> = isPaid
        ? { ...baseEventData, isPaid: true as const, price: price! }
        : { ...baseEventData, isPaid: false as const };

    try {
        await connectToDatabase();
        await CreateNewEvent(finalEventData);

        return NextResponse.json({ message: "Evento adicionado com sucesso!" }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar evento:", error);
        return NextResponse.json({ message: "Erro interno ao salvar no banco de dados." }, { status: 500 });
    }
}
