import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logo = await readFile(join(process.cwd(), "public", "logoFZAC.jpg"));
  const source = `data:image/jpeg;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          display: "flex",
          overflow: "hidden",
          borderRadius: "999px"
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source} alt="" width={64} height={64} style={{ objectFit: "cover" }} />
      </div>
    ),
    size
  );
}
