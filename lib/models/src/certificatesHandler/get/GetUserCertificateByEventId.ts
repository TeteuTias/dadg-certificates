"use server";
import Certificate from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "bson";
import { auth0 } from "@/lib/auth0";
import { isAdmin } from "@/lib/security/isAdmin";
export default async function GetUserCertificateByEventId(eventId:string|ObjectId):Promise<{_id:string;ownerName:string;frontTopperText?:string;frontBottomText?:string}|null>{
 const session=await auth0.getSession();if(!session?.user||!isAdmin(session.user))throw new Error("FORBIDDEN");
 if(!ObjectId.isValid(eventId))return null;await connectToDatabase();
 const certificate=await Certificate.findOne({eventId:new ObjectId(eventId)}).select("_id ownerName frontTopperText frontBottomText").lean();
 return certificate?{_id:String(certificate._id),ownerName:certificate.ownerName,frontTopperText:certificate.frontTopperText,frontBottomText:certificate.frontBottomText}:null;
}
