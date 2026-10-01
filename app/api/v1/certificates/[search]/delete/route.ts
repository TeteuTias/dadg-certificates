import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { connectToDatabase } from "@/lib/mongodb";
import Certificate from "@/lib/models/CertificateModel";
import { EventAudit } from "@/lib/events/Audit";
import GateKeeper from "@/lib/security/gatekeeper";
export const DELETE=withRouteAccess(async(request:NextRequest,{params}:{params:Promise<{search:string}>})=>{
 const {search}=await params;if(!/^[a-f0-9]{24}$/i.test(search))return Response.json({message:"Código inválido."},{status:400});
 const actor=await new GateKeeper(request).identifyAdmin();await connectToDatabase();const session=await mongoose.startSession();
 try {const exists=await session.withTransaction(async()=>{
  const certificate=await Certificate.findById(search).session(session);if(!certificate)return false;
  if(!certificate.revokedAt){certificate.isReady=false;certificate.revokedAt=new Date();await certificate.save({session});
   await EventAudit.create([{eventId:certificate.eventId,participantId:certificate.participantId,actor:actor?.sub,action:"certificate.revoked",details:search}],{session});}
  return true;
 });return Response.json({message:exists?"Certificado retirado da consulta. Histórico preservado.":"Certificado não encontrado."},{status:exists?200:404});}
 finally{await session.endSession();}
});
