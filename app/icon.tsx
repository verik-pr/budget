import { ImageResponse } from "next/og"

export const size = { width: 512, height: 512 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div style={{
      background: "#000000",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        background: "#16a34a",
        width: "80%",
        height: "80%",
        borderRadius: "22%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 260,
        fontWeight: 900,
        color: "#ffffff",
        letterSpacing: "-8px",
      }}>
        B
      </div>
    </div>,
    { width: 512, height: 512 }
  )
}
