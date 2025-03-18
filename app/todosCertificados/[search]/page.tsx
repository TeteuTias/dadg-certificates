"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import { PoppinsFontLib } from "@/public/fonts/lib/Poppins";


export default function Page({ params }: { params: Promise<{ search: string }> }) {
    const [isLoading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<ICertificateWithEventPopulate[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const slug = (await params).search
            if (slug !== "allCertificates") {
                setSearchQuery(slug)
            }
            const res = await fetch("/api/get/allCertificates/");
            if (!res.ok) {
                console.log("Ocorreu algum erro");
                return;
            }
            const dataJson: { data: ICertificateWithEventPopulate[] } = await res.json();
            setData(dataJson.data);
            setLoading(false);
        };
        fetchData();
    }, [params]);

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
    const filteredData = data.filter((cert) => {
        const query = searchQuery.toLowerCase();

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
    });


    return (
        <main className="w-full h-svh flex items-center justify-center flex-col space-y-5" style={PoppinsFontLib.style}>
            <div>
                <h1 className="text-[40px] font-extrabold">TODOS OS CERTIFICADOS</h1>
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
            <article className="min-h-96 max-h-96 border-[1px] overflow-auto p-5 space-y-10">
                {filteredData.length === 0 ? (
                    <h1>Nenhum certificado encontrado</h1>
                ) : (
                    filteredData.map((certificate) => (
                        <CertificateComponent key={String(certificate._id)} certificate={certificate} />
                    ))
                )}
            </article>
        </main>
    );
}

const CertificateComponent: React.FC<{ certificate: ICertificateWithEventPopulate }> = ({ certificate }) => {
    return (
        <div className="shadow-xl py-5 px-5 space-y-5 border-b-[2px] border-r-[2px] rounded-2xl border-blue-800">
            <div className="">

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Usuário</h1>
                    <p>{certificate.ownerName}</p>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Identificação de Evento</h1>
                    <p onClick={() => console.log(certificate)}>{ String(certificate?.eventId?._id) }</p>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Identificação do Certificado</h1>
                    <p>{String(certificate._id)}</p>
                </div>

                <div className="flex flex-col">
                    <h1 className="text-[12px] font-extrabold">Nome do Evento</h1>
                    <p>{certificate.eventName}</p>
                </div>

            </div>
            <div className="space-x-1">
                <Link
                    prefetch={false}
                    href={`https://www.dadg.com.br/certificados/meuCertificado/${certificate._id}`}
                    target="_blank"
                    className=""
                >
                    <div className="p-5 bg-red-900 font-extrabold text-white">
                        Ver Certificado
                    </div>
                </Link>
                <Link
                    prefetch={false}
                    href={`/todosCertificados/modificar/${certificate._id}`}
                    target="_blank"
                    className=""
                >
                    <div className="p-5 bg-red-900 font-extrabold text-white">
                        Editar Certificado
                    </div>
                </Link>
            </div>
        </div>
    );
};
