import {NextRequest} from "next/server";
import {withRouteAccess} from "@/lib/security/route-access";
import {connectToDatabase} from "@/lib/mongodb";
import Event from "@/lib/models/EventCertificateModel";
import {getSignedUrl} from "@/lib/certificates/storage";
export const GET=withRouteAccess(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const {id}=await params;if(!/^[a-f0-9]{24}$/i.test(id))return Response.json({error:"Evento inválido"},{status:400});
 await connectToDatabase();const event=await Event.findById(id).select("templatePath").lean();
 if(!event?.templatePath)return Response.json({error:"Template ausente"},{status:404});
 const url=await getSignedUrl(process.env.R2_BUCKET_NAME||"",event.templatePath);if(!url)return Response.json({error:"Template ausente"},{status:404});
 const response=await fetch(url);if(!response.ok)return Response.json({error:"Template indisponível"},{status:502});
 return new Response(response.body,{headers:{"Content-Type":response.headers.get("content-type")||"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
});
