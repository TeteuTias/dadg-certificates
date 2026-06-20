const mongoose = require('mongoose');
const { Schema } = mongoose;
require('dotenv').config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
    console.error("MONGODB_URI not found in .env.local");
    process.exit(1);
}

const CertificateSchema = new Schema({ ownerCpf: String }, { collection: "certificates.datails" });
const EventCertificateSchema = new Schema({}, { collection: "certificates.events" });
const AcademicLeagueSchema = new Schema({}, { collection: "clam.data" });

async function getStats() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 5000 });
        console.log("Connected!");

        const CertificateModel = mongoose.models.Certificate || mongoose.model('Certificate', CertificateSchema);
        const EventCertificateModel = mongoose.models.EventCertificate || mongoose.model('EventCertificate', EventCertificateSchema);
        const AcademicLeagueModel = mongoose.models.AcademicLeague || mongoose.model('AcademicLeague', AcademicLeagueSchema);

        const [alunosRepresentados, eventosRealizados, coordenadoriasAtivas, certificadosEmitidos] = await Promise.all([
            CertificateModel.distinct('ownerCpf').then(cpfs => cpfs.length),
            EventCertificateModel.countDocuments(),
            AcademicLeagueModel.countDocuments(),
            CertificateModel.countDocuments()
        ]);

        console.log({
            alunosRepresentados,
            eventosRealizados,
            coordenadoriasAtivas,
            certificadosEmitidos
        });
        
        process.exit(0);
    } catch (error) {
        console.error("Error fetching stats:", error.message);
        process.exit(1);
    }
}

getStats();
