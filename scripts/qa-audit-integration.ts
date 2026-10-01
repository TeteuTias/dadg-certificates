/** Explicit opt-in only. Never reads .env and never accepts an external Mongo URI. */
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
async function main() {
  if (process.env.APPROVED_TEMP_DB_TEST !== "yes")
    throw new Error("Requires explicit approval: APPROVED_TEMP_DB_TEST=yes");
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri("dadg_audit_integration");
  process.env.MONGODB_DB = "dadg_audit_integration";
  process.env.PROFILE_CPF_ACTIVE_KEY_VERSION = "test";
  process.env.PROFILE_CPF_ENCRYPTION_KEY_TEST = Buffer.alloc(32, 1).toString(
    "base64",
  );
  process.env.PROFILE_CPF_LOOKUP_KEY = Buffer.alloc(32, 2).toString("base64");
  process.env.MERCADOPAGO_ACCESS_TOKEN = "test-only";
  process.env.MERCADOPAGO_WEBHOOK_SECRET = "test-only";
  try {
    const { connectToDatabase } = await import("../lib/mongodb");
    await connectToDatabase();
    const { default: Profile } = await import("../lib/models/UserProfileModel");
    const { default: Privacy } =
      await import("../lib/models/PrivacyAcceptanceModel");
    const { default: Event } =
      await import("../lib/models/EventCertificateModel");
    const { default: Participant } =
      await import("../lib/models/EventParticipant");
    const { EventOrder } = await import("../lib/events/PaymentOrder");
    const { EventAudit } = await import("../lib/events/Audit");
    const { default: Certificate } =
      await import("../lib/models/CertificateModel");
    const { CertificateClaim } = await import("../lib/certificates/Claim");
    const { encryptCpf, cpfLookup } = await import("../lib/profile/crypto");
    const { PROFILE_PRIVACY_NOTICE_HASH, PROFILE_PRIVACY_NOTICE_VERSION } =
      await import("../lib/profile/privacy-notice");
    const { default: Keeper } = await import("../lib/security/gatekeeper");
    const { register, cancelRegistration } =
      await import("../lib/events/registration");
    const { MpGateway } =
      await import("../lib/selective-processes/services/gateway");
    const { reconcileEventOrder } = await import("../lib/events/reconcile");
    for (const model of [
      Profile,
      Privacy,
      Event,
      Participant,
      EventOrder,
      EventAudit,
      Certificate,
      CertificateClaim,
    ]) {
      await model.createCollection();
    }
    await Participant.createIndexes();
    await Profile.createIndexes();
    const profile = await Profile.create({
      authIssuer: "https://test.invalid/",
      authSubject: "google-oauth2|not-an-object-id",
      name: "Pessoa Teste",
      period: 1,
      cpfEncrypted: encryptCpf("52998224725"),
      cpfLookup: cpfLookup("52998224725"),
    });
    await Privacy.create({
      profileId: profile._id,
      noticeVersion: PROFILE_PRIVACY_NOTICE_VERSION,
      noticeHash: PROFILE_PRIVACY_NOTICE_HASH,
      acceptedAt: new Date(),
      authIssuer: profile.authIssuer,
      authSubject: profile.authSubject,
      source: "profile-web",
    });
    Keeper.prototype.identifyStudent = async () => ({
      sub: profile.authSubject,
      iss: profile.authIssuer,
      email: "person@example.com",
      email_verified: true,
    });
    const future = new Date(Date.now() + 86400000),
      end = new Date(Date.now() + 90000000);
    const makeEvent = (paid = false) =>
      Event.create({
        eventName: "Evento Teste",
        eventDescription: "Teste sintético",
        eventType: "Extensão",
        styleContainer: {},
        styleFrontTopperText: {},
        styleFrontBottomText: {},
        styleNameText: {},
        templatePath: "test.png",
        maxParticipants: 1,
        isPaid: paid,
        ...(paid ? { price: 10 } : {}),
        certificateHours: "4h",
        statusDetails: {
          status: "PUBLISHED_OPEN",
          registrationStartDate: new Date(Date.now() - 60000),
          registrationEndDate: new Date(Date.now() + 60000),
          timeLine: [{ startDate: future, endDate: end, description: "Teste" }],
        },
      });
    const request = new NextRequest(
      "https://test.invalid/api/v1/events/x/registration",
      { method: "POST" },
    );
    const event = await makeEvent();
    await Promise.all([
      register(request, String(event._id)),
      register(request, String(event._id)),
    ]);
    assert.equal(await Participant.countDocuments({ eventId: event._id }), 1);
    assert.equal((await Event.findById(event._id))?.registrationCount, 1);
    await cancelRegistration(request, String(event._id));
    assert.equal(await Participant.countDocuments({ eventId: event._id }), 1);
    assert.equal((await Event.findById(event._id))?.registrationCount, 0);
    assert.equal(
      (await Participant.findOne({ eventId: event._id }))?.status,
      "CANCELLED",
    );
    let preferences = 0;
    MpGateway.prototype.create = async (
      reference,
      _contract,
      _payer,
      expiresAt,
    ) => {
      preferences++;
      return {
        id: "pref-test",
        init_point: "https://www.mercadopago.com.br/checkout/test",
        expires: true,
        expiration_date_to: expiresAt.toISOString(),
        external_reference: reference,
      };
    };
    const paid = await makeEvent(true);
    const checkout = await register(request, String(paid._id));
    assert.equal(checkout.status, "PENDING");
    assert.equal(preferences, 1);
    await register(request, String(paid._id));
    assert.equal(preferences, 1);
    const participant = await Participant.findOne({ eventId: paid._id });
    assert.ok(participant?.activePaymentId);
    const orderId = String(participant.activePaymentId);
    const gateway = new MpGateway();
    gateway.payments = async () => [
      {
        id: "payment-test",
        reference: orderId,
        status: "approved",
        amountCents: 1000,
        currency: "BRL",
        refundedCents: 0,
        updatedAt: new Date().toISOString(),
      },
    ];
    await reconcileEventOrder(orderId, false, gateway);
    await reconcileEventOrder(orderId, false, gateway);
    assert.equal(
      (await Participant.findById(participant._id))?.status,
      "CONFIRMED",
    );
    assert.equal((await Event.findById(paid._id))?.registrationCount, 1);
    const repeat = await register(request, String(paid._id));
    assert.equal(repeat.status, "CONFIRMED");
    assert.equal("paymentUrl" in repeat, false);
    await assert.rejects(cancelRegistration(request, String(paid._id)));
    const { certificateDetails, searchCertificates } =
      await import("../lib/certificates/public-handlers");
    const hidden = await Certificate.create({
      ownerName: "Pessoa Teste",
      ownerCpf: "52998224725",
      ownerEmail: "person@example.com",
      eventName: "Teste",
      eventId: event._id,
      certificateHours: "4h",
      isReady: false,
    });
    const ctx = { params: Promise.resolve({ search: String(hidden._id) }) };
    assert.equal((await certificateDetails(request, ctx)).status, 404);
    const found = await (await searchCertificates(request, ctx)).json();
    assert.equal(found.data.length, 0);
    await Certificate.updateOne(
      { _id: hidden._id },
      { $set: { isReady: true } },
    );
    const visible = await (await certificateDetails(request, ctx)).json();
    assert.equal(visible.data.ownerCpf, undefined);
    assert.equal(visible.data.ownerEmail, undefined);
    console.log(
      "PASS: social identity, parallel registration, capacity, cancellation history, paid reservation, checkout idempotency, webhook replay, paid cancellation boundary, publication and private-data projection",
    );
  } finally {
    await mongoose.disconnect();
    await repl.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
