import mongoose from 'mongoose';

// We must import models dynamically or normally
import EventModel from './lib/models/EventCertificateModel';
import EventParticipant from './lib/models/EventParticipant';
import CertificateModel from './lib/models/CertificateModel';

async function runTest() {
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected!');

  const testEventId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();
  const testCpf = '12345678900';
  const testQrToken = 'test-token-123';

  try {
      console.log('\n--- 1. ADMIN CREATES EVENT ---');
      const event = await EventModel.create({
        _id: testEventId,
        eventName: 'Evento de Teste Automatizado',
        eventDescription: 'Teste de ponta a ponta',
        styleContainer: {},
        styleFrontTopperText: {},
        styleFrontBottomText: {},
        styleNameText: {},
        templatePath: 'test_path',
        registrationCount: 0,
        eventType: 'TEST',
        documentVersion: 'v1',
        maxParticipants: 100,
        useStatementFormat: false,
        certificateHours: '10 horas',
        certificateReleased: false,
        isPaid: false,
        statusDetails: {
            status: 'PUBLISHED_OPEN',
            timeLine: [{
                id: new mongoose.Types.ObjectId(),
                startDate: new Date(),
                endDate: new Date(Date.now() + 86400000),
                description: 'First Day'
            }],
            registrationStartDate: new Date(),
            registrationEndDate: new Date(Date.now() + 86400000)
        }
      });
      console.log('Event created:', event.eventName);

      console.log('\n--- 2. STUDENT REGISTERS ---');
      const participant = await EventParticipant.create({
        eventId: testEventId,
        owner: testUserId,
        ownerName: 'Aluno Teste',
        ownerEmail: 'aluno@teste.com',
        ownerCpf: testCpf,
        qrToken: testQrToken,
        checkedIn: false,
        checkedOut: false
      });
      console.log('Participant registered:', participant.ownerName, '| QR Token:', participant.qrToken);

      console.log('\n--- 3. STUDENT ATTENDS (CHECKIN) ---');
      const checkedInParticipant = await EventParticipant.findOneAndUpdate(
        { qrToken: participant.qrToken, eventId: testEventId },
        { checkedIn: true, checkedInAt: new Date() },
        { new: true }
      );
      if (!checkedInParticipant) throw new Error('Participant not found');
      console.log('Participant scanned (Check-in). Checked In:', checkedInParticipant.checkedIn);

      console.log('\n--- 4. STUDENT LEAVES (CHECKOUT) ---');
      const checkedOutParticipant = await EventParticipant.findOneAndUpdate(
        { qrToken: participant.qrToken, eventId: testEventId },
        { checkedOut: true, checkedOutAt: new Date() },
        { new: true }
      );
      if (!checkedOutParticipant) throw new Error('Participant not found');
      console.log('Participant scanned (Check-out). Checked Out:', checkedOutParticipant.checkedOut);

      console.log('\n--- 5. ADMIN RELEASES CERTIFICATE (Require Checkout) ---');
      // Simulated release logic
      const eligibleParticipants = await EventParticipant.find({
          eventId: testEventId,
          checkedIn: true,
          checkedOut: true
      });
      
      console.log(`Found ${eligibleParticipants.length} eligible participants (checked in and out).`);

      const certificateDocs = eligibleParticipants.map(p => ({
          ownerName: p.ownerName,
          ownerCpf: p.ownerCpf,
          ownerEmail: p.ownerEmail,
          eventName: event.eventName,
          certificateHours: event.certificateHours,
          eventId: event._id,
          templatePath: event.templatePath,
          isReady: true,
          verse: { showVerse: false }
      }));

      const insertedCerts = await CertificateModel.insertMany(certificateDocs);
      console.log('Certificates generated:', insertedCerts.length);

  } catch (e) {
      console.error('Test failed:', e);
  } finally {
      console.log('\n--- CLEANUP ---');
      await EventModel.findByIdAndDelete(testEventId);
      await EventParticipant.deleteMany({ eventId: testEventId });
      await CertificateModel.deleteMany({ eventId: testEventId });
      console.log('Cleanup done!');
      
      process.exit(0);
  }
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
