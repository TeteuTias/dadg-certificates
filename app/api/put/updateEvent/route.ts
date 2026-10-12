import { withRouteAccess } from "@/lib/security/route-access";
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import EventCertificateModel, { IEventCertificate } from '@/lib/models/EventCertificateModel';
import { buildEventStatusDetails } from '@/lib/events/statusDetails';
import { pricingChanged } from '@/lib/events/rules';

async function PUTHandler(request: Request) {
    try {
        await connectToDatabase();

        // 1. Recebemos o corpo da requisição
        let rawData = await request.json();
        // 2. Se o frontend enviou stringificado, forçamos a conversão para objeto
        if (typeof rawData === 'string') {
            rawData = JSON.parse(rawData);
        }
        // 3. Agora podemos tipar com seguranca e desestruturar
        const formData = rawData as Partial<IEventCertificate> & {
            _id?: unknown;
            status?: unknown;
            registrationStartDate?: unknown;
            registrationEndDate?: unknown;
            timeLine?: unknown;
        };
        const {
            _id,
            status,
            registrationStartDate,
            registrationEndDate,
            timeLine,
            statusDetails,
            ...restUpdateData
        } = formData;
        const allowed = ["eventName","eventDescription","eventType","eventBenefits","styleContainer","styleContainerVerse","styleFrontTopperText","styleFrontBottomText","styleNameText","templatePath","templateVersePath","maxParticipants","certificateHours","minAttendancePercent","isPaid","price","useStatementFormat"];
        const updateData = Object.fromEntries(Object.entries(restUpdateData).filter(([key])=>allowed.includes(key))) as Partial<IEventCertificate>;
        const existing = await EventCertificateModel.findById(_id).lean();
        if (existing && updateData.maxParticipants !== undefined && updateData.maxParticipants < (existing.registrationCount || 0)) return NextResponse.json({success:false,message:"Capacidade inferior às vagas já ocupadas."},{status:409});
        if (existing?.registrationCount && pricingChanged(existing, updateData)) return NextResponse.json({success:false,message:"Não altere o preço de um evento com inscrições."},{status:409});
        if (updateData.certificateHours !== undefined) {
            if (typeof updateData.certificateHours !== "string" || updateData.certificateHours.trim().length > 60) {
                return NextResponse.json({ success: false, message: "Carga horária inválida: use um texto de até 60 caracteres." }, { status: 400 });
            }
            updateData.certificateHours = updateData.certificateHours.trim();
        }
        if (updateData.minAttendancePercent !== undefined) {
            const percent = Number(updateData.minAttendancePercent);
            if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
                return NextResponse.json({ success: false, message: "Presença mínima inválida: use um número inteiro de 1 a 100." }, { status: 400 });
            }
            updateData.minAttendancePercent = percent;
        }

        if (typeof _id !== 'string') {
            return NextResponse.json(
                { success: false, message: '_id e invalido ou esta ausente' },
                { status: 400 }
            );
        }

        const statusPayload = statusDetails ?? (
            status !== undefined
                ? { status, registrationStartDate, registrationEndDate, timeLine }
                : undefined
        );

        if (statusPayload) {
            const statusDetailsResult = buildEventStatusDetails(statusPayload, existing?.statusDetails?.timeLine);

            if (statusDetailsResult.error) {
                return NextResponse.json(
                    { success: false, message: statusDetailsResult.error },
                    { status: 400 }
                );
            }

            updateData.statusDetails = statusDetailsResult.statusDetails;
        }

        const update = await EventCertificateModel.findOneAndUpdate(
            { _id, registrationCount: existing?.registrationCount ?? {$exists:false} },
            { $set: updateData },
            { new: true, runValidators: true }
        ).lean();

        if (!update) {
            return NextResponse.json(
                { success: false, message: 'Evento alterado simultaneamente. Atualize os dados e tente novamente.' },
                { status: 409 }
            );
        }
        return NextResponse.json({ success: true, data: update });

    } catch (error) {
        let message = 'Erro ao atualizar o certificado.';
        if (error instanceof Error) {
            message = error.message;
        }
        return NextResponse.json(
            { success: false, message },
            { status: 500 }
        );
    }
}

export const PUT = withRouteAccess(PUTHandler);
