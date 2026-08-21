import { randomUUID } from "node:crypto";
import { ObjectId } from "bson";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import EventParticipant from "@/lib/models/EventParticipant";
import PrivacyAcceptanceModel from "@/lib/models/PrivacyAcceptanceModel";
import UserProfileModel from "@/lib/models/UserProfileModel";
import { connectToDatabase } from "@/lib/mongodb";
import { assertProfileCryptoConfigured, decryptCpf, ProfileCryptoConfigurationError } from "@/lib/profile/crypto";
import { PROFILE_PRIVACY_NOTICE_HASH, PROFILE_PRIVACY_NOTICE_VERSION } from "@/lib/profile/privacy-notice";
import { identityFromToken } from "@/lib/profile/service";
import GateKeeper from "@/lib/security/gatekeeper";

interface RouteParams { params: Promise<{ id: string }> }
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function studentOwner(request: NextRequest) {
  const user = await new GateKeeper(request).identifyStudent();
  if (!user?.sub) return null;
  const rawOwnerId = user.sub.includes("|") ? user.sub.split("|")[1] : user.sub;
  if (!ObjectId.isValid(rawOwnerId)) return null;
  return { user, ownerId: new ObjectId(rawOwnerId) };
}
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return json({ success: false, error: "ID de evento inválido." }, 400);
  const identity = await studentOwner(request);
  if (!identity) return json({ success: false, error: "Usuário não autenticado." }, 401);
  try {
    await connectToDatabase();
    const registration = await EventParticipant.findOne({
      eventId: new ObjectId(id),
      owner: identity.ownerId,
    }).select({ ownerCpf: 0, ownerEmail: 0 }).populate("eventId").lean();
    if (!registration) return json({ success: false, error: "Inscrição não encontrada." }, 404);
    return json({ success: true, data: registration });
  } catch (error) {
    console.error("[GET registration]", error instanceof Error ? error.name : "UnknownError");
    return json({ success: false, error: "Erro interno ao carregar inscrição." }, 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return json({ success: false, error: "ID de evento inválido." }, 400);
  const authenticated = await studentOwner(request);
  if (!authenticated) return json({ success: false, error: "Usuário não autenticado." }, 401);

  try {
    assertProfileCryptoConfigured();
    await connectToDatabase();
    const tokenIdentity = identityFromToken(authenticated.user);
    const profile = await UserProfileModel.findOne(tokenIdentity).lean();
    if (!profile) {
      return json({ success: false, code: "PROFILE_INCOMPLETE", error: "Complete seu perfil antes de fazer uma nova inscrição." }, 428);
    }
    const accepted = await PrivacyAcceptanceModel.exists({
      profileId: profile._id,
      noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
      noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
    });
    if (!accepted) {
      return json({ success: false, code: "PRIVACY_NOTICE_REQUIRED", error: "Aceite o aviso de privacidade vigente antes da inscrição." }, 428);
    }

    const emailClaim = process.env.STUDENT_AUTH0_EMAIL_CLAIM?.trim() || "email";
    const emailValue = authenticated.user[emailClaim];
    const ownerEmail = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return json({ success: false, code: "AUTHENTICATED_EMAIL_REQUIRED", error: "A conta autenticada não forneceu um e-mail válido." }, 428);
    }

    const ownerCpf = decryptCpf(profile.cpfEncrypted);
    const eventId = new ObjectId(id);
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const event = await EventCertificateModel.findOne({
        _id: eventId,
        "statusDetails.status": "PUBLISHED_OPEN",
      }).session(session).lean();
      if (!event) {
        await session.abortTransaction();
        return json({ success: false, error: "Evento não encontrado ou inscrições fechadas." }, 404);
      }
      const now = new Date();
      const start = event.statusDetails.registrationStartDate ? new Date(event.statusDetails.registrationStartDate) : null;
      const end = event.statusDetails.registrationEndDate ? new Date(event.statusDetails.registrationEndDate) : null;
      if ((start && now < start) || (end && now > end)) {
        await session.abortTransaction();
        return json({ success: false, error: "Fora do período de inscrições." }, 403);
      }
      if (await EventParticipant.exists({ eventId, owner: authenticated.ownerId }).session(session)) {
        await session.abortTransaction();
        return json({ success: false, error: "Você já está inscrito neste evento." }, 409);
      }
      const updatedEvent = await EventCertificateModel.findOneAndUpdate(
        {
          _id: eventId,
          "statusDetails.status": "PUBLISHED_OPEN",
          $expr: { $lt: ["$registrationCount", "$maxParticipants"] },
        },
        { $inc: { registrationCount: 1 } },
        { session, new: true, runValidators: true },
      ).lean();
      if (!updatedEvent) {
        await session.abortTransaction();
        return json({ success: false, error: "Evento lotado ou inscrições indisponíveis no momento." }, 409);
      }
      await EventParticipant.create([{
        eventId,
        owner: authenticated.ownerId,
        ownerName: profile.name,
        ownerEmail,
        ownerCpf,
        qrToken: randomUUID(),
        checkedIn: false,
      }], { session });
      await session.commitTransaction();
      return json({
        success: true,
        message: "Inscrição realizada com sucesso!",
        data: { eventId: updatedEvent._id, registrationCount: updatedEvent.registrationCount },
      }, 201);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof ProfileCryptoConfigurationError) {
      return json({ success: false, code: "AUTH_CONFIGURATION_ERROR", error: "Configuração segura do perfil indisponível." }, 503);
    }
    console.error("[POST registration]", error instanceof Error ? error.name : "UnknownError");
    return json({ success: false, error: "Erro interno ao processar inscrição." }, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return json({ success: false, error: "ID de evento inválido." }, 400);
  const authenticated = await studentOwner(request);
  if (!authenticated) return json({ success: false, error: "Usuário não autenticado." }, 401);
  await connectToDatabase();
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const eventId = new ObjectId(id);
    const participant = await EventParticipant.findOne({ eventId, owner: authenticated.ownerId }).session(session);
    if (!participant) {
      await session.abortTransaction();
      return json({ success: false, error: "Inscrição não encontrada." }, 404);
    }
    await EventParticipant.deleteOne({ _id: participant._id }).session(session);
    const event = await EventCertificateModel.findOneAndUpdate(
      { _id: eventId, registrationCount: { $gt: 0 } },
      { $inc: { registrationCount: -1 } },
      { session, new: true },
    );
    if (!event) {
      await session.abortTransaction();
      return json({ success: false, error: "Não foi possível liberar a vaga." }, 500);
    }
    await session.commitTransaction();
    return json({ success: true, message: "Inscrição cancelada e vaga liberada com sucesso." });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error("[DELETE registration]", error instanceof Error ? error.name : "UnknownError");
    return json({ success: false, error: "Erro interno ao processar cancelamento." }, 500);
  } finally {
    await session.endSession();
  }
}
