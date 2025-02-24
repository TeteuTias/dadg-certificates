import { NextResponse } from "next/server";
// import EventCertificateModel from "@/lib/models/EventCertificateModel";
// import { connectToDatabase } from "@/lib/mongodb";


export async function GET() {
    
    // await connectToDatabase()
    /*
    const a = await new EventCertificateModel({
        eventName: "Currículo Nota 10",
        eventDescription: "Evento realizado e organizado pela Coordenadoria de Extensão e Pesquisa do DADG. O intúito do evento é mostrar vivências e distribuir conhecimento sobre o que é necssário para construir um currículo para residências em todo o país. O evento ocorreu nos dias 20 á 22 de Agosto de 2024."
    })
    */
    //await a.save()
    
    return NextResponse.json({ "olá": "mundo" })
}