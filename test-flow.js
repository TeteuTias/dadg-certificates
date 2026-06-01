const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function runTest() {
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected!');

  // Require models
  const EventModel = require('./lib/models/EventCertificateModel').default;
  const EventParticipant = require('./lib/models/EventParticipant').default;
  const CertificateModel = require('./lib/models/CertificateModel').default;

  const testEventId = new mongoose.Types.ObjectId();
  const testUserId = 'auth0|testuser123';
  const testCpf = '123.456.789-00';

  console.log('\n--- 1. ADMIN CREATES EVENT ---');
  const event = await EventModel.create({
    _id: testEventId,
    name: 'Evento de Teste Automatizado',
    description: 'Teste de ponta a ponta',
    eventDate: new Date(),
    workload: 10,
    coverImage: 'https://test.com/img.jpg',
    createdBy: 'admin_test'
  });
  console.log('Event created:', event.name);

  console.log('\n--- 2. STUDENT REGISTERS ---');
  const participant = await EventParticipant.create({
    eventId: testEventId,
    userId: testUserId,
    name: 'Aluno Teste',
    email: 'aluno@teste.com',
    cpf: testCpf,
    attended: false
  });
  console.log('Participant registered:', participant.name, '| QR Code:', participant.qrCodeId);

  console.log('\n--- 3. STUDENT ATTENDS (QR SCAN) ---');
  // Simulate scanning endpoint logic
  const scannedParticipant = await EventParticipant.findOneAndUpdate(
    { qrCodeId: participant.qrCodeId, eventId: testEventId },
    { attended: true, attendedAt: new Date() },
    { new: true }
  );
  console.log('Participant scanned. Attended:', scannedParticipant.attended);

  console.log('\n--- 4. ADMIN RELEASES CERTIFICATE ---');
  // Simulate bulk release logic
  const certificate = await CertificateModel.create({
    name: scannedParticipant.name,
    email: scannedParticipant.email,
    cpf: scannedParticipant.cpf,
    eventId: testEventId,
    userId: scannedParticipant.userId,
    workload: event.workload,
    status: 'ACTIVE',
    date: new Date().toLocaleDateString('pt-BR')
  });
  console.log('Certificate generated for:', certificate.name, '| Workload:', certificate.workload);

  console.log('\n--- CLEANUP ---');
  await EventModel.findByIdAndDelete(testEventId);
  await EventParticipant.findByIdAndDelete(participant._id);
  await CertificateModel.findByIdAndDelete(certificate._id);
  console.log('Cleanup done!');

  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
