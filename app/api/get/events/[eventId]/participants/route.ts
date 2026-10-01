import { withRouteAccess } from "@/lib/security/route-access";
const retired=withRouteAccess(async()=>Response.json({error:"Use /api/v1/events/:id/participants para consulta e /registration para inscrições."},{status:410}));
export const GET=retired;
export const POST=retired;
export const PUT=retired;
export const DELETE=retired;
