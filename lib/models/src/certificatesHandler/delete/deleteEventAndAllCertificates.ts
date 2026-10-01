import mongoose from "mongoose";
import Event from "@/lib/models/EventCertificateModel";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import { auth0 } from "@/lib/auth0";
import { isAdmin } from "@/lib/security/isAdmin";
import { EventAudit } from "@/lib/events/Audit";
export async function DeleteEventAndAllCertificates(eventId:ObjectId){
 const actor=await auth0.getSession();if(!actor?.user||!isAdmin(actor.user))throw new Error("FORBIDDEN");
 await connectToDatabase();const session=await mongoose.startSession();
 try{return await session.withTransaction(async()=>{
  const event=await Event.findById(eventId).session(session);if(!event)return null;
  if(!event.archivedAt){event.archivedAt=new Date();event.statusDetails.status="PUBLISHED_CLOSED";await event.save({session});
   await EventAudit.create([{eventId,actor:actor.user.sub,action:"event.archived",details:"Certificates and participants preserved"}],{session});}
  return event.toObject();
 });}finally{await session.endSession();}
}
