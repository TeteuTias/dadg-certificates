"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";


export default function Page() {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<IEventCertificate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const res = await fetch("/api/get/allEvents/");
            if (!res.ok) {
                console.log("Ocorreu algum erro");
                return;
            }
            const dataJson: { data: IEventCertificate[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <main className="w-full h-svh flex items-center justify-center">
                <div>
                    <h1>C A R R E G A N D O</h1>
                </div>
            </main>
        );
    }

    // Filtra os certificados com base no termo de busca (searchQuery)
    const filteredData = data.filter((event) => {
        const query = searchQuery.toLowerCase();


        return (
            event.eventName?.toLowerCase().includes(query) ||
            event.eventDescription?.toLowerCase().includes(query) ||
            // Busca pelo eventId
            // Busca pelo ID do evento
            (event._id && String(event._id).toLowerCase().includes(query))
        )
        /*
        return (
            cert._id.toString().toLowerCase().includes(query) ||
            cert.ownerName?.toLowerCase().includes(query) ||
            cert.ownerCpf?.toLowerCase().includes(query) ||
            cert.eventName?.toLowerCase().includes(query) ||
            cert.ownerEmail?.toLowerCase().includes(query) ||
            cert.certificateHours?.toLowerCase().includes(query) ||
            cert.certificatePath?.toLowerCase().includes(query) ||
            (cert.frontTopperText && cert.frontTopperText.toLowerCase().includes(query)) ||
            (cert.frontBottomText && cert.frontBottomText.toLowerCase().includes(query)) ||
            // Busca pelo nome do evento
            (cert.eventId && cert.eventId.eventName.toLowerCase().includes(query)) ||
            // Busca pelo ID do evento
            (cert.eventId && String(cert.eventId._id).toLowerCase().includes(query))
        );
        */
    });


    return (
        <main className="w-full h-svh flex items-center justify-center flex-col space-y-5" style={PoppinsFontLib.style}>
            <div>
                <h1 className="text-[40px] font-extrabold">TODOS OS EVENTOS</h1>
            </div>
            {/* Campo de busca */}
            <div className="w-full flex items-center justify-center flex flex-col space-y-1">

                <input

                    type="text"
                    placeholder="Pesquisar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border p-2 min-w-[400px]"
                />
                {
                    filteredData.length != 0 &&
                    <h1>
                        FORAM ENCONTRADOS <span className="font-extrabold text-red-800">{filteredData.length}</span> RESULTADOS
                    </h1>
                }


            </div>
            <article className="min-h-96 max-h-96 border-[1px] overflow-auto p-5 space-y-10 w-3/5">
                {filteredData.length === 0 ? (
                    <h1>Nenhum certificado encontrado</h1>
                ) : (
                    filteredData.map((event) => (
                        <EventComponent key={String(event._id)} event={event} />
                    ))
                )}
            </article>
        </main>
    );
}

const EventComponent: React.FC<{ event: IEventCertificate }> = ({ event }) => {
    return (
        <div className="shadow-xl py-5 px-5 space-y-5 border-b-[2px] border-r-[2px] rounded-2xl border-blue-800">
            <div className="">

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Identificação</h1>
                    <p>{String(event._id)}</p>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Nome do Evento</h1>
                    <p>{event.eventName}</p>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Descrição do Evento</h1>
                    <p>{String(event.eventDescription)}</p>
                </div>

            </div>
            <div className="space-x-1">
                <Link
                    prefetch={false}
                    href={`/todosEventos/modificar/${event._id}`}
                    target="_blank"
                    className=""
                >
                    <div className="p-5 bg-red-900 font-extrabold text-white">
                        Editar Grupo
                    </div>
                </Link>
            </div>
        </div>
    );
};
