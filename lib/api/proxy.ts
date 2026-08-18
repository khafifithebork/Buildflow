import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "@/lib/session";
import { logServerError } from "@/lib/logger";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

export async function proxyToBackend(req: NextRequest, backendPath: string) {
    const token = await getSessionCookie();

    const headers = new Headers(req.headers);
    headers.set("Authorization", `Bearer ${token || ""}`);

    // Remove host header to avoid issues with the backend expecting its own host
    headers.delete("host");

    const url = new URL(req.url);
    const backendUrl = `${BACKEND_URL}/api/v1${backendPath}${url.search}`;

    let body: string | ArrayBuffer | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
        try {
            const contentType = req.headers.get("content-type") || "";
            // Binary bodies (e.g. multipart file uploads) must not be decoded
            // as text, or the file bytes get corrupted through re-encoding.
            body = contentType.startsWith("multipart/form-data")
                ? await req.clone().arrayBuffer()
                : await req.clone().text();
        } catch {
            // No body
        }
    }

    try {
        const response = await fetch(backendUrl, {
            method: req.method,
            headers,
            body,
            // don't cache API proxy requests
            cache: "no-store",
        });

        // The body is forwarded as bytes, never decoded.
        //
        // It used to be read with response.text(), which decodes as UTF-8. That
        // is lossless for JSON and destructive for anything else: an .xlsx is a
        // ZIP, and every byte sequence that is not valid UTF-8 became U+FFFD.
        // A 10 KB export came out at 17 KB with 3 461 replacement characters
        // and a wrecked central directory — Excel refused it as corrupt.
        // Passing the ArrayBuffer through is exactly as correct for JSON and
        // stops the proxy having an opinion about what it carries.
        const bytes = await response.arrayBuffer();

        if (response.status >= 500) {
            logServerError("proxy.backend_error", { path: backendPath, method: req.method, status: response.status });
        }

        // Null-body statuses (204/205/304) must not be constructed with a body,
        // even a null/empty one, or the Response constructor throws.
        if (response.status === 204 || response.status === 205 || response.status === 304) {
            return new NextResponse(null, { status: response.status });
        }

        // Only headers that describe the payload travel with it. Hop-by-hop
        // headers (content-encoding, transfer-encoding) must not: fetch has
        // already decoded the body, so forwarding them would describe bytes
        // that no longer exist. Content-Disposition matters here — it carries
        // the download filename, and dropping it cost the export its date.
        const outHeaders = new Headers();
        for (const name of ["content-type", "content-disposition", "cache-control"]) {
            const value = response.headers.get(name);
            if (value) outHeaders.set(name, value);
        }
        // Un corps sans type déclaré est de l'octet ; un corps vide n'est rien,
        // et annoncer un type sur une réponse vide — un 401 ou un 403 de Spring
        // Security n'en a pas — ne ferait qu'égarer le prochain qui lira ces
        // en-têtes.
        if (!outHeaders.has("content-type") && bytes.byteLength > 0) {
            outHeaders.set("content-type", "application/octet-stream");
        }

        return new NextResponse(bytes, { status: response.status, headers: outHeaders });
    } catch (err) {
        logServerError("proxy.backend_unreachable", {
            path: backendPath,
            method: req.method,
            message: err instanceof Error ? err.message : "unknown",
        });
        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 502 }
        );
    }
}
