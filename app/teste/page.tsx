'use client';

import React, { useState } from 'react';
import { IEventParticipantWithEventPopulate } from '@/lib/models/EventParticipant';
import { ObjectId } from 'bson';
import { IEventCertificate } from '@/lib/models/EventCertificateModel';
// ==========================================
// 2. MOCKS (Atualizados para testar meses e status)
// ==========================================
const CURRENT_USER_ID = new ObjectId();
const CURRENT_USER_NAME = 'João Desenvolvedor';

const MOCK_EVENTS: IEventCertificate[] = [
    // Eventos em Abril
    { _id: new ObjectId(), eventName: 'Workshop de React Native', eventDescription: 'Aprenda a criar apps mobile.', eventDate: '2026-04-15', registrationCount: 15, maxParticipants: 30, isOpen: true, isPaid: false, eventType: 'Workshop', documentVersion: '1.0', useStatementFormat: false },
    { _id: new ObjectId(), eventName: 'Simpósio de IA', eventDescription: 'O futuro da IA.', eventDate: '2026-04-20', registrationCount: 100, maxParticipants: 100, isOpen: false, isPaid: false, eventType: 'Simpósio', documentVersion: '1.0', useStatementFormat: true },
    { _id: new ObjectId(), eventName: 'Evento Passado Fechado', eventDescription: 'Você perdeu este evento.', eventDate: '2026-04-05', registrationCount: 50, maxParticipants: 50, isOpen: false, isPaid: false, eventType: 'Palestra', documentVersion: '1.0', useStatementFormat: false },
    // Eventos em Maio
    { _id: new ObjectId(), eventName: 'Curso de Next.js', eventDescription: 'Framework React.', eventDate: '2026-05-10', registrationCount: 5, maxParticipants: 20, isOpen: true, isPaid: true, price: 50.0, eventType: 'Curso', documentVersion: '1.0', useStatementFormat: false },
    { _id: new ObjectId(), eventName: 'Hackathon Global', eventDescription: 'Maratona de programação.', eventDate: '2026-05-25', registrationCount: 200, maxParticipants: 200, isOpen: false, isPaid: true, price: 100.0, eventType: 'Hackathon', documentVersion: '1.0', useStatementFormat: true },
    // Eventos em Junho
    { _id: new ObjectId(), eventName: 'Palestra de Segurança', eventDescription: 'Proteja seus sistemas.', eventDate: '2026-06-15', registrationCount: 20, maxParticipants: 50, isOpen: true, isPaid: false, eventType: 'Palestra', documentVersion: '1.0', useStatementFormat: false },
    { _id: new ObjectId(), eventName: 'Evento Futuro Fechado', eventDescription: 'Evento que ainda não ocorreu, mas já fechou inscrições.', eventDate: '2026-06-20', registrationCount: 50, maxParticipants: 50, isOpen: false, isPaid: false, eventType: 'Workshop', documentVersion: '1.0', useStatementFormat: false },
];


// ==========================================
// 3. COMPONENTES DE UI
// ==========================================

// --- COMPONENTE: CALENDÁRIO INTERATIVO ---
const InteractiveCalendar = ({
    events,
    participations,
    onDayClick
}: {
    events: IEventCertificate[],
    participations: IEventParticipantWithEventPopulate[],
    onDayClick: (date: string, eventsOnDay: IEventCertificate[]) => void
}) => {
    // Começamos em Abril de 2026 baseado nos mocks
    const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 1)); // Mês 3 = Abril
    const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Preenche espaços em branco do início do mês
    const blanks = Array(firstDayOfWeek).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const handleDateClick = (day: number) => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setSelectedDateStr(dateStr);
        const eventsOnDay = events.filter(e => e.eventDate === dateStr);
        onDayClick(dateStr, eventsOnDay);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header do Calendário */}
            <div className="flex justify-between items-center p-4 bg-slate-800 text-white">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-700 rounded-lg font-bold transition-colors">&lt; Anterior</button>
                <h3 className="font-bold text-lg">{monthNames[month]} {year}</h3>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-700 rounded-lg font-bold transition-colors">Próximo &gt;</button>
            </div>

            {/* Grid de Dias */}
            <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-500">
                    <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {blanks.map((_, i) => <div key={`blank-${i}`} className="p-2"></div>)}

                    {days.map(day => {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = selectedDateStr === dateStr;
                        const eventsToday = events.filter(e => e.eventDate === dateStr);

                        // Lógica de cores (Verde se estou inscrito, Azul se tem evento, Cinza se vazio)
                        const amIParticipating = eventsToday.some(e => participations.some(p => p.eventId._id === e._id));
                        let dotColor = null;
                        if (eventsToday.length > 0) {
                            dotColor = amIParticipating ? 'bg-emerald-500' : 'bg-blue-500';
                        }

                        return (
                            <button
                                key={day}
                                onClick={() => handleDateClick(day)}
                                className={`relative h-12 w-full rounded-lg flex flex-col items-center justify-center text-sm transition-all
                  ${isSelected ? 'bg-blue-100 border-2 border-blue-500 font-bold text-blue-800' : 'hover:bg-gray-100 border-2 border-transparent text-gray-700'}
                `}
                            >
                                {day}
                                {dotColor && <div className={`absolute bottom-1.5 w-2 h-2 rounded-full ${dotColor}`}></div>}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-4 flex gap-4 text-xs justify-center text-gray-500 border-t pt-4">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Inscrito</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Há Eventos</span>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// 4. PÁGINA PRINCIPAL (DASHBOARD)
// ==========================================
export default function EventDashboard() {
    const [events] = useState<IEventCertificate[]>(MOCK_EVENTS);
    const [participations, setParticipations] = useState<IEventParticipantWithEventPopulate[]>([
        { _id: new ObjectId(), eventId: MOCK_EVENTS[1], owner: CURRENT_USER_ID, ownerName: CURRENT_USER_NAME }, // Inscrito no ev2 (Abril 20)
    ]);

    // Estado para os eventos do dia clicado no calendário
    const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string, list: IEventCertificate[] } | null>(null);

    // --- LÓGICA ---
    const isParticipating = (eventId: string) => participations.some((p) => `${p.eventId._id}` === `${eventId}`);

    const handleRegister = (event: IEventCertificate) => {
        if (!event.isOpen) return alert('Inscrições encerradas!');
        const newPart: IEventParticipantWithEventPopulate = { _id: new ObjectId(), eventId: event, owner: CURRENT_USER_ID, ownerName: CURRENT_USER_NAME };
        setParticipations([...participations, newPart]);
        alert('Inscrito com sucesso!');
    };

    const handleUnregister = (participationId: string, event: IEventCertificate) => {
        if (!event.isOpen) return alert('Evento já fechado! Não é possível cancelar.');
        if (event.isPaid) return alert('Atenção: Contate o Diretório Acadêmico para cancelar evento pago.');
        setParticipations(participations.filter((p) => `${p._id}` !== `${participationId}`));
    };

    const handleDayClick = (date: string, eventsOnDay: IEventCertificate[]) => {
        setSelectedDayEvents({ date, list: eventsOnDay });
    };

    // --- DADOS DERIVADOS PARA AS COLUNAS ---

    // 1. Cronograma (Onde estou escalado) - Ordenado por data
    const mySchedule = [...participations].sort((a, b) => new Date(a.eventId.eventDate).getTime() - new Date(b.eventId.eventDate).getTime());

    // 2. Eventos Fechados que NÃO participei
    const missedEvents = events.filter(e => !e.isOpen && !isParticipating(`${e._id}`));

    return (
        <main className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
            <header className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-extrabold text-slate-800">Meu Painel de Eventos</h1>
                <p className="text-slate-500">Gerencie sua agenda, veja dias disponíveis e o que você perdeu.</p>
            </header>

            {/* GRID PRINCIPAL: 3 Colunas em telas grandes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUNA 1: CALENDÁRIO & DETALHES DO DIA */}
                <div className="flex flex-col gap-6">
                    <section>
                        <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">📅 Explorar Eventos</h2>
                        <InteractiveCalendar events={events} participations={participations} onDayClick={handleDayClick} />
                    </section>

                    {/* Resultado do clique no calendário */}
                    {selectedDayEvents && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                            <h3 className="font-bold text-blue-900 mb-3 border-b border-blue-200 pb-2">
                                Eventos em {selectedDayEvents.date.split('-').reverse().join('/')}
                            </h3>

                            {selectedDayEvents.list.length === 0 ? (
                                <p className="text-sm text-blue-700">Nenhum evento programado para este dia.</p>
                            ) : (
                                <div className="space-y-4">
                                    {selectedDayEvents.list.map(evt => {
                                        const inscrito = isParticipating(`${evt._id}`);
                                        return (
                                            <div key={`${evt._id}`} className="bg-white p-3 rounded-lg shadow-sm border border-blue-100 text-sm">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-bold text-slate-800">{evt.eventName}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${evt.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {evt.isOpen ? 'Aberto' : 'Fechado'}
                                                    </span>
                                                </div>
                                                <p className="text-slate-500 text-xs mb-3">{evt.eventDescription}</p>

                                                {!inscrito ? (
                                                    <button
                                                        onClick={() => handleRegister(evt)}
                                                        disabled={!evt.isOpen}
                                                        className={`w-full py-2 rounded text-xs font-bold transition-colors ${evt.isOpen ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                                                    >
                                                        {evt.isOpen ? 'Garantir Vaga' : 'Inscrições Encerradas'}
                                                    </button>
                                                ) : (
                                                    <div className="w-full text-center py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded border border-emerald-200">
                                                        Você já está inscrito ✓
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUNA 2: MEU CRONOGRAMA */}
                <div className="lg:col-span-1">
                    <section className="bg-slate-900 rounded-2xl p-6 shadow-xl h-full border border-slate-800">
                        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">⏱️ Onde Estou Escalado</h2>

                        {mySchedule.length === 0 ? (
                            <div className="bg-slate-800/50 p-6 rounded-xl text-center border border-slate-700">
                                <p className="text-slate-400">Você não tem eventos agendados.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-slate-700 ml-3 space-y-6">
                                {mySchedule.map(part => (
                                    <div key={`${part._id}`} className="relative pl-6">
                                        {/* Ponto na timeline */}
                                        <div className="absolute -left-[9px] top-1.5 w-4 h-4 bg-emerald-500 rounded-full ring-4 ring-slate-900"></div>

                                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors">
                                            <h4 className="font-bold text-white text-sm mb-1">{part.eventId.eventName}</h4>
                                            <p className="text-emerald-400 text-xs font-bold mb-3">📅 {part.eventId.eventDate.split('-').reverse().join('/')}</p>

                                            <button
                                                onClick={() => handleUnregister(`${part._id}`, part.eventId)}
                                                className="w-full text-xs py-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-colors"
                                            >
                                                Cancelar Participação
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* COLUNA 3: EVENTOS PERDIDOS (Fechados e não inscrito) */}
                <div className="lg:col-span-1">
                    <section className="bg-rose-50/50 rounded-2xl p-6 shadow-sm border border-rose-100 h-full">
                        <h2 className="text-xl font-bold mb-6 text-rose-900 flex items-center gap-2">🔒 Eventos Encerrados</h2>
                        <p className="text-sm text-rose-700/70 mb-4 pb-4 border-b border-rose-200">
                            Eventos que já fecharam as inscrições e você não conseguiu participar.
                        </p>

                        {missedEvents.length === 0 ? (
                            <p className="text-emerald-600 font-medium text-sm text-center py-4 bg-white rounded-lg shadow-sm">
                                Incrível! Você não perdeu nenhum evento até agora.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {missedEvents.map(evt => (
                                    <div key={`${evt._id}`} className="bg-white p-4 rounded-xl shadow-sm border border-rose-100 opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
                                        <h4 className="font-bold text-slate-700 text-sm">{evt.eventName}</h4>
                                        <div className="flex justify-between items-center mt-2 text-xs">
                                            <span className="text-slate-500">Ocorreu em: {evt.eventDate.split('-').reverse().join('/')}</span>
                                            <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold">Encerrado</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

            </div>
        </main>
    );
}