import { NextRequest } from "next/server";
import { withRouteAccess } from "@/lib/security/route-access";
import { eventIdentity } from "@/lib/events/identity";
import Participant from "@/lib/models/EventParticipant";
export const GET=withRouteAccess(async(request:NextRequest)=>{
 try{const identity=await eventIdentity(request,false);const data=await Participant.find({...identity.ownerFilter,status:{$ne:"CANCELLED"}}).select("eventId status").lean();return Response.json({data},{headers:{"Cache-Control":"private, no-store"}});}
 catch{return Response.json({error:"Complete seu perfil para consultar inscrições."},{status:428});}
});
