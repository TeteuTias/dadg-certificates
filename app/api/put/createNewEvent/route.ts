import { NextResponse } from "next/server"
import CreateNewEvent from "@/lib/models/src/certificatesHandler/put/CreateNewEvent";
import { connectToDatabase } from "@/lib/mongodb";

export async function PUT(request: Request) {
    const formData = await request.formData();

    // Configurando os campos do front
    const eventName = formData.get("eventName");
    const eventDescription = formData.get("eventDescription");
    const templatePath = formData.get("templatePath");
    const templateVersePath = formData.get("templateVersePath") as string;
    const eventType = formData.get("eventType");
    const maxParticipantsRaw = formData.get("maxParticipants");
    const isOpenRaw = formData.get("isOpen");
    const isPaidRaw = formData.get("isPaid");
    const priceRaw = formData.get("price");

    // Validando front
    if (!templatePath || typeof templatePath !== "string") {
        return NextResponse.json({ message: "Forneça o caminho do template." }, { status: 400 });
    }
    if (!eventName || typeof eventName !== "string") {
        return NextResponse.json({ message: "Forneça o nome do evento." }, { status: 400 });
    }
    if (!eventDescription || typeof eventDescription !== "string") {
        return NextResponse.json({ message: "Forneça a descrição do evento." }, { status: 400 });
    }
    if (!eventType || typeof eventType !== "string") {
        return NextResponse.json({ message: "Forneça o tipo do evento." }, { status: 400 });
    }


    // Convertenso e validando ...
    const maxParticipants = Number(maxParticipantsRaw);
    if (isNaN(maxParticipants) || maxParticipants <= 0) {
        return NextResponse.json({ message: "Forneça uma quantidade máxima de participantes válida." }, { status: 400 });
    }

    const isOpen = isOpenRaw === "true";
    const isPaid = isPaidRaw === "true";

    // Adicionado ou não o preço
    let price: number | undefined = undefined;
    if (isPaid) {
        price = Number(priceRaw);
        if (isNaN(price) || price < 0) {
            return NextResponse.json({ message: "O evento é pago, forneça um valor válido." }, { status: 400 });
        }
    }

    // Fazendo o pyload ...
    const baseEventData = {
        eventName: eventName,
        eventDescription: eventDescription,
        templatePath: templatePath,
        templateVersePath: templateVersePath || "",
        eventType: eventType,
        maxParticipants: maxParticipants,
        isOpen: isOpen,
        styleContainerVerse: {
            containerStyle: {
                border: "1.5px solid",
                width: "50%",
                color: "#02425A"
            },
            rowsStyle: {
                textAlign: "center",
                backgroundColor: "",
                padding: "25px",
                fontSize: "20px",
                border: "1.5px solid"
            },
            headerStyle: {
                fontSize: "25px",
                border: "1.5px solid",
                padding: "30px"
            }
        },
        styleContainer: {
            width: "90%",
            top: "-30px",
            left: "55px",
            textAlign: "center",
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
    };

    // Aplicando o playload no payload final ...
    const finalEventData = isPaid
        ? { ...baseEventData, isPaid: true as const, price: price! }
        : { ...baseEventData, isPaid: false as const };

    try {
        await connectToDatabase();
        await CreateNewEvent(finalEventData as any); // O "as any" pode ser necessário dependendo de como a tipagem do CreateNewEvent foi feita, mas a lógica está 100% segura.

        return NextResponse.json({ message: "Evento adicionado com sucesso!" }, { status: 201 });
    } catch (error) {
        console.error("Erro ao criar evento:", error);
        return NextResponse.json({ message: "Erro interno ao salvar no banco de dados." }, { status: 500 });
    }
}