import { NextResponse } from "next/server"
import CreateNewEvent from "@/lib/models/src/certificatesHandler/put/CreateNewEvent";
import { connectToDatabase } from "@/lib/mongodb";
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
    await connectToDatabase()
    await CreateNewEvent({
        eventDescription: eventDescription,
        eventName: eventName,
        styleContainer: {
            "width": "90%",
            "top": "-30px",
            "left": "55px",
            "textAlign": "center",
            "color": "02425A"
        },
        styleFrontTopperText: {
            "lineHeight": 1.6,
            "fontSize": "50.5px",
            "fontWeight": "400",
            "color": "#02425A"
        },
        styleFrontBottomText: {
            "lineHeight": 1.6,
            "fontSize": "50.5px",
            "fontWeight": "400",
            "color": "#02325A"
        },
        styleNameText: {
            "fontSize": "55.5px",
            "fontWeight": "800",
            "lineHeight": 1.5,
            "color": "#02425A"
        },
        styleContainerVerse: {
            containerStyle: {
                border: "1.5px solid",
                width: "50%"
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
        templatePath: templatePath,
    })

    return NextResponse.json({ message: "Evento adicionado com sucesso!" })
}