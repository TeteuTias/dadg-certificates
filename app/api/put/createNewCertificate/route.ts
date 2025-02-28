import { NextResponse } from "next/server"
import CreateNewCertificate from "@/lib/models/src/certificatesHandler/put/CreateNewCertificate";
import { ObjectId } from "mongodb";

export async function PUT(request: Request) {

    const formData = await request.formData();

    const eventId = formData.get("eventId")
    const eventName = formData.get("eventName")
    const ownerName = formData.get("ownerName")
    const ownerEmail = formData.get("ownerEmail")
    const ownerCpf = formData.get("ownerCpf")
    const frontTopperText = formData.get("frontTopperText")
    const frontBottomText = formData.get("frontBottomText")
    const certificatePath = formData.get("certificatePath")
    const certificateHours = formData.get("certificateHours")

    if (!eventName || eventName === undefined || typeof eventName !== "string") {
        return NextResponse.json({ message: "Forneça o ID do evento." }, { status: 500 });
    }

    if (!eventId || eventId === undefined || typeof eventId !== "string") {
        return NextResponse.json({ message: "Forneça o ID do evento." }, { status: 500 });
    }

    if (!ownerName || ownerName === undefined || typeof ownerName !== "string") {
        return NextResponse.json({ message: "Forneça o nome do usuário." }, { status: 500 });
    }

    if (!ownerEmail || ownerEmail === undefined || typeof ownerEmail !== "string") {
        return NextResponse.json({ message: "Forneça o email do usuário." }, { status: 500 });
    }

    if (!ownerCpf || ownerCpf === undefined || typeof ownerCpf !== "string") {
        return NextResponse.json({ message: "Forneça o CPF do usuário." }, { status: 500 });
    }

    if (!frontTopperText || frontTopperText === undefined || typeof frontTopperText !== "string") {
        return NextResponse.json({ message: "Forneça o texto superior do certificado." }, { status: 500 });
    }

    if (!frontBottomText || frontBottomText === undefined || typeof frontBottomText !== "string") {
        return NextResponse.json({ message: "Forneça o texto inferior do certificado." }, { status: 500 });
    }

    if (!certificatePath || certificatePath === undefined || typeof certificatePath !== "string") {
        return NextResponse.json({ message: "Forneça o caminho do template do certificado." }, { status: 500 });
    }

    if (!certificateHours || certificateHours === undefined || typeof certificateHours !== "string") {
        return NextResponse.json({ message: "Forneça as horas do certificado." }, { status: 500 });
    }


    const update = await CreateNewCertificate({
        eventId: new ObjectId(eventId),
        eventName: eventName,
        ownerName: ownerName,
        ownerEmail: ownerEmail,
        ownerCpf: ownerCpf,
        frontTopperText: frontTopperText,
        frontBottomText: frontBottomText,
        certificatePath: certificatePath,
        certificateHours: certificateHours,

    })

    return NextResponse.json({ _id: update })
}