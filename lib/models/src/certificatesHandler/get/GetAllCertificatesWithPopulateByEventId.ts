import CertificateModel, { ICertificateWithEventPopulate } from "@/lib/models/CertificateModel";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type GetAllCertificatesOptions = {
    page?: number;
    limit?: number;
    search?: string;
};

export type GetAllCertificatesResult = {
    data: ICertificateWithEventPopulate[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
};

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function GetAllCertificatesWithPopulateByEventId(
    options: GetAllCertificatesOptions = {},
): Promise<GetAllCertificatesResult> {
    await connectToDatabase();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 60));
    const skip = (page - 1) * limit;
    const rawSearch = options.search?.trim() || "";

    let query: Record<string, unknown> = {};

    if (rawSearch) {
        const regex = new RegExp(escapeRegex(rawSearch), "i");
        const certificateFilters: Record<string, unknown>[] = [
            { ownerName: regex },
            { ownerCpf: regex },
            { eventName: regex },
            { ownerEmail: regex },
            { certificateHours: regex },
            { certificatePath: regex },
            { frontTopperText: regex },
            { frontBottomText: regex },
        ];

        if (ObjectId.isValid(rawSearch)) {
            const objectId = new ObjectId(rawSearch);
            certificateFilters.push({ _id: objectId });
            certificateFilters.push({ eventId: objectId });
        }

        const eventQuery = ObjectId.isValid(rawSearch)
            ? { $or: [{ eventName: regex }, { _id: new ObjectId(rawSearch) }] }
            : { eventName: regex };

        const matchingEvents = await EventCertificateModel.find(eventQuery).select("_id").lean();
        if (matchingEvents.length > 0) {
            certificateFilters.push({
                eventId: {
                    $in: matchingEvents.map((event) => event._id),
                },
            });
        }

        query = { $or: certificateFilters };
    }

    const [data, total] = await Promise.all([
        CertificateModel.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .populate<{ eventId: ICertificateWithEventPopulate["eventId"] }>("eventId")
            .lean(),
        CertificateModel.countDocuments(query),
    ]);

    return {
        data,
        total,
        page,
        limit,
        hasMore: skip + data.length < total,
    };
}
