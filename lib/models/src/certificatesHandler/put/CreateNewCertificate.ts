import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { getUserId } from "@/lib/getUserId";
import type { ICertificate } from "@/lib/models/CertificateModel";
import CertificateModel from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import CreateNewModificationHistory from "./CreateNewModificationHistory";

export default async function CreateNewCertificate(props: Omit<ICertificate, "_id">): Promise<ObjectId> {
  await connectToDatabase();
  const data = await new CertificateModel({ ...props }).save();
  const userId = await getUserId();
  const user = await getSession();

  await CreateNewModificationHistory({
    modifiedElementId: new ObjectId(data._id),
    modifiedUserId: new ObjectId(userId),
    modifiedDocumentType: "certificate",
    userName: `${user?.user.name}`,
    modificationDate: new Date(),
    description: `Certificado ${data._id} criado. Campos registrados: evento, carga horária, template e textos do certificado. Dados pessoais do titular foram omitidos da auditoria.`,
    httpMethods: "put",
  });

  return data._id;
}
