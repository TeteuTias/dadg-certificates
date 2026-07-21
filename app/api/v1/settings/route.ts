import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AppSettingsModel from "@/lib/models/AppSettingsModel";

// GET /api/v1/settings
export async function GET() {
  try {
    await connectToDatabase();
    
    // Attempt to find the single settings document
    let settings = await AppSettingsModel.findOne({});
    
    // If not exists, create the default
    if (!settings) {
      settings = await AppSettingsModel.create({ blogEnabled: true });
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    console.error("[GET /api/v1/settings] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/v1/settings
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { blogEnabled } = body;

    await connectToDatabase();

    let settings = await AppSettingsModel.findOne({});
    if (!settings) {
      settings = await AppSettingsModel.create({ blogEnabled: blogEnabled ?? true });
    } else {
      if (typeof blogEnabled === 'boolean') {
        settings.blogEnabled = blogEnabled;
        await settings.save();
      }
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (error) {
    console.error("[PUT /api/v1/settings] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
