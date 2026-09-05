import mongoose from 'mongoose';
async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.argv.includes('--approved') || !process.env.CLAM_MAINTENANCE_URI || !process.env.CLAM_MAINTENANCE_DB) throw new Error('Approval, explicit URI and database are required.');
  if (apply && !process.env.CLAM_RECOVERABLE_BACKUP) throw new Error('Confirm the recoverable backup identifier before writes.');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  await mongoose.connect(process.env.CLAM_MAINTENANCE_URI, { dbName: process.env.CLAM_MAINTENANCE_DB, autoIndex: false, autoCreate: false });
  try {
    const { prepareClamStorage } = await import('../lib/selective-processes/maintenance');
    const report = await prepareClamStorage(apply);
    console.log(JSON.stringify({ database: mongoose.connection.name, apply, ...report }, null, 2));
    if (report.duplicateIndexes.length) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.name + ': ' + error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted]')); process.exitCode = 1; });
