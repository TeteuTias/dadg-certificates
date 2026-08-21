import { ObjectId } from "mongodb";
import { auth0 } from "@/lib/auth0";
import { getUserId } from "@/lib/getUserId";
import type { ICertificate } from "@/lib/models/CertificateModel";
import CertificateModel from "@/lib/models/CertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import CreateNewModificationHistory from "./CreateNewModificationHistory";

export default async function CreateNewCertificate(props: Omit<ICertificate, "_id">): Promise<ObjectId> {
  await connectToDatabase();
  const data = await new CertificateModel({ ...props }).save();
  const userId = await getUserId();
  const user = await auth0.getSession();

  await CreateNewModificationHistory({
    modifiedElementId: new ObjectId(data._id),
    modifiedUserId: new ObjectId(userId),
    modifiedDocumentType: "certificate",
    userName: `${user?.user.nickname}`,
    modificationDate: new Date(),
    description: `Certificado ${data._id} criado. Campos registrados: evento, carga horária, template e textos do certificado. Dados pessoais do titular foram omitidos da auditoria.`,
    httpMethods: "put",
  });

  return data._id;
}
