import { searchCertificates } from "@/lib/certificates/public-handlers";
import { withRouteAccess } from "@/lib/security/route-access";
export const GET = withRouteAccess(searchCertificates);
