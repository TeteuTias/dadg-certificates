import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import GateKeeper from "@/lib/security/gatekeeper";
import { connectToDatabase } from "@/lib/mongodb";
import { CertificateClaim } from "@/lib/certificates/Claim";
import Certificate from "@/lib/models/CertificateModel";
import { ownerNames } from "@/lib/certificates/matching";
export const PATCH = withRouteAccess(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const body = await request.json().catch(() => null);
    if (
      !body ||
      !["APPROVED", "REJECTED", "REVOKED", "KEEP"].includes(body.status) ||
      typeof body.reason !== "string" ||
      body.reason.trim().length < 10 ||
      body.reason.length > 1000
    )
      return Response.json(
        { error: "Informe decisão e justificativa de 10 a 1.000 caracteres." },
        { status: 400 },
      );
    const actor = await new GateKeeper(request).identifyAdmin();
    if (!actor)
      return Response.json({ error: "Não autorizado" }, { status: 403 });
    await connectToDatabase();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claim = await CertificateClaim.findById(
          (await params).id,
        ).session(session);
        if (!claim) throw new Error("Solicitação não encontrada.");
        const removalOpen = Boolean(claim.removal?.requestedAt && !claim.removal.resolvedAt);
        // KEEP é só a resposta a um pedido de remoção do aluno: o vínculo fica como está.
        if (body.status === "KEEP") {
          if (claim.status !== "APPROVED" || !removalOpen)
            throw new Error("Não há pedido de remoção aberto. Atualize a lista.");
          claim.removal!.resolvedAt = new Date();
          claim.removal!.decision = "KEPT";
          // Decisão humana: a troca de dados do perfil não devolve este vínculo à revisão automática.
          claim.reviewedBy = actor.sub;
          claim.reviewedAt = new Date();
          claim.history.push({ status: "APPROVED", reason: `Vínculo mantido: ${body.reason.trim()}`, actor: actor.sub, at: new Date() });
          await claim.save({ session });
          return;
        }
        if (
          (body.status === "REVOKED" && claim.status !== "APPROVED") ||
          (body.status !== "REVOKED" && claim.status !== "PENDING")
        )
          throw new Error("Solicitação já revisada. Atualize a lista.");
        if (body.status === "APPROVED") {
          const result = await Certificate.updateOne(
            { _id: claim.certificateId, profileId: null, isReady: true },
            { $set: { profileId: claim.profileId } },
            { session },
          );
          if (!result.modifiedCount) {
            // Trabalho em conjunto: o certificado já tem outro dono e ganha mais um pelo vínculo.
            const certificate = await Certificate.findOne({ _id: claim.certificateId, isReady: true })
              .select("ownerName")
              .session(session)
              .lean();
            if (!certificate || !ownerNames(certificate.ownerName).joint)
              throw new Error("Certificado indisponível ou já vinculado.");
          }
        }
        if (body.status === "REVOKED") {
          await Certificate.updateOne(
            { _id: claim.certificateId, profileId: claim.profileId },
            { $unset: { profileId: 1 } },
            { session },
          );
          if (removalOpen) {
            claim.removal!.resolvedAt = new Date();
            claim.removal!.decision = "REMOVED";
          }
        }
        claim.history.push({
          status: body.status,
          reason: body.reason.trim(),
          actor: actor.sub,
          at: new Date(),
        });
        claim.status = body.status;
        claim.reason = body.reason.trim();
        claim.reviewedBy = actor.sub;
        claim.reviewedAt = new Date();
        await claim.save({ session });
      });
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 409 });
    } finally {
      await session.endSession();
    }
  },
);
