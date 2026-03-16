import { IEventCertificate } from "@/lib/models/EventCertificateModel";
import EventCertificateModel from "@/lib/models/EventCertificateModel";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type GetAllEventsOptions = {
    page?: number;
    limit?: number;
    search?: string;
};

export type GetAllEventsResult = {
    data: IEventCertificate[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
};

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function GetAllEvents(options: GetAllEventsOptions = {}): Promise<GetAllEventsResult> {
    await connectToDatabase();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 48));
    const skip = (page - 1) * limit;
    const rawSearch = options.search?.trim() || "";

    let query: Record<string, unknown> = {};

    if (rawSearch) {
        const regex = new RegExp(escapeRegex(rawSearch), "i");
        const filters: Record<string, unknown>[] = [
            { eventName: regex },
            { eventDescription: regex },
            { eventType: regex },
        ];

        if (ObjectId.isValid(rawSearch)) {
            filters.push({ _id: new ObjectId(rawSearch) });
        }

        query = { $or: filters };
    }

    const [data, total] = await Promise.all([
        EventCertificateModel.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        EventCertificateModel.countDocuments(query),
    ]);

    return {
        data,
        total,
        page,
        limit,
        hasMore: skip + data.length < total,
    };
}
