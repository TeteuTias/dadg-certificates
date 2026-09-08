import mongoose from 'mongoose';
import { SelectionProcess } from './models/SelectionProcessModel';
import { PaymentSession } from './models/PaymentSessionModel';
import { PaymentAttribution } from './models/PaymentAttributionModel';
import { Application } from './models/ApplicationModel';
import { Ticket } from './models/TicketModel';
import { Reservation } from './models/ReservationModel';
import { Exam } from './models/ExamModel';
import { PricingTier } from './models/PricingTierModel';
import { ApplicationLeagueSelection } from './models/ApplicationLeagueSelectionModel';
export const clamModels = [SelectionProcess, PaymentSession, PaymentAttribution, Application, Ticket, Reservation, Exam, PricingTier, ApplicationLeagueSelection];

/** Explicit maintenance only. No connection, indexes, or writes on import. Stop CLAM traffic before apply. */
export async function prepareClamStorage(apply: boolean) {
  const db = mongoose.connection.db!;
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  const report = { duplicateIndexes: [] as string[], legacyProcesses: [] as string[], initializedProcesses: [] as string[] };
  for (const model of clamModels) {
    if (!names.has(model.collection.name)) continue;
    for (const [keys, options] of model.schema.indexes()) {
      if (!options.unique) continue;
      const group = Object.fromEntries(Object.keys(keys).map(key => [key, '$' + key]));
      const duplicates = await db.collection(model.collection.name).aggregate([
        ...(options.partialFilterExpression ? [{ $match: options.partialFilterExpression }] : []),
        ...(Object.keys(keys).includes('paymentIds') ? [{ $unwind: '$paymentIds' }] : []),
        { $group: { _id: group, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 },
      ]).toArray();
      if (duplicates.length) report.duplicateIndexes.push(model.collection.name + ':' + Object.keys(keys).join(','));
    }
  }
  if (report.duplicateIndexes.length) return report; // Never delete/merge records to force an index.
  if (apply) {
    for (const model of clamModels) {
      const collection = db.collection(model.collection.name);
      if (!names.has(collection.collectionName)) await db.createCollection(collection.collectionName);
      for (const [keys, options] of model.schema.indexes()) {
        const existing = (await collection.listIndexes().toArray()).find(i => JSON.stringify(i.key) === JSON.stringify(keys));
        if (existing && Boolean(existing.unique) !== Boolean(options.unique)) await collection.dropIndex(existing.name!);
        await collection.createIndex(keys as Parameters<typeof collection.createIndex>[0], options as Parameters<typeof collection.createIndex>[1]);
      }
    }
  }
  if (names.has(SelectionProcess.collection.name)) {
    const processes = await SelectionProcess.collection.find({ accountingVersion: { $ne: 1 } }).toArray();
    for (const p of processes) {
      const linked = await PaymentSession.collection.findOne({ edicaoId: String(p._id) }) ||
        await Application.collection.findOne({ selectionProcessId: p._id }) ||
        await Ticket.collection.findOne({ selectionProcessId: p._id }) ||
        await Reservation.collection.findOne({ selectionProcessId: p._id });
      if (linked) report.legacyProcesses.push(String(p._id));
      else if (apply) {
        await SelectionProcess.collection.updateOne({ _id: p._id, accountingVersion: { $ne: 1 } }, { $set: { accountingVersion: 1, allocatedCount: 0, revision: 0 } });
        report.initializedProcesses.push(String(p._id));
      }
    }
  }
  return report;
}
