import { NextResponse } from "next/server";
import { createAttachmentToken, extractUploadedFiles, FileExtractionError, isUploadFile, readBoundedUploadForm, tooLargeRequest } from "@/lib/file-extraction";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload files using a multipart/form-data request." }, { status: 415 });
  }
  if (tooLargeRequest(request.headers.get("content-length"))) {
    return NextResponse.json({ error: "The combined upload size must be 20 MB or smaller." }, { status: 413 });
  }

  try {
    const form = await readBoundedUploadForm(request);
    const entries = form.getAll("files");
    if (!entries.length || entries.some((entry) => !isUploadFile(entry))) {
      return NextResponse.json({ error: "Choose one or more valid files to upload." }, { status: 400 });
    }
    const files = entries.filter(isUploadFile);
    const extracted = await extractUploadedFiles(files, { apiKey: process.env.GEMINI_API_KEY });
    const token = createAttachmentToken(extracted, process.env.UPLOAD_TOKEN_SECRET || process.env.GEMINI_API_KEY, "synapse-demo");
    return NextResponse.json({ files: extracted, token }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FileExtractionError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("File upload extraction failed:", error);
    return NextResponse.json({ error: "The files could not be read. Try a smaller, valid document or image." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
