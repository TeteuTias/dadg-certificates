import { NextResponse } from "next/server"
import CreateNewEvent from "@/lib/models/src/certificatesHandler/put/CreateNewEvent";

export async function PUT(request: Request) {

    const formData = await request.formData();
    const eventName = formData.get("eventName")
    const eventDescription = formData.get("eventDescription")
    const templatePath = formData.get("templatePath")

    if (!templatePath || templatePath == undefined || typeof templatePath !== "string") {
        return NextResponse.json({ message: "Forneça o caminho do template." }, { status: 500 })
    }

    if (!eventName || eventName == undefined || typeof eventName !== "string") {
        return NextResponse.json({ message: "Forneça o nome do evento." }, { status: 500 })
    }

    if (!eventDescription || eventDescription == undefined || typeof eventDescription !== "string") {
        return NextResponse.json({ message: "Forneça a descrição do evento." }, { status: 500 })
    }

    await CreateNewEvent({
        eventDescription: eventDescription,
        eventName: eventName,
        styleContainer: {},
        styleFrontTopperText: {},
        styleFrontBottomText: {},
        styleNameText: {},
        templatePath: templatePath,
    })

    return NextResponse.json({ message: "Evento adicionado com sucesso!" })
}