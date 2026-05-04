import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
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
        background: "linear-gradient(150deg, #22c55e 0%, #15803d 100%)",
        width: "78%",
        height: "78%",
        borderRadius: "22%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingLeft: "15%",
        paddingRight: "15%",
        paddingBottom: "15%",
        gap: "7%",
      }}>
        <div style={{ background: "rgba(255,255,255,0.55)", flex: 1, height: "38%", borderRadius: "4px 4px 2px 2px" }} />
        <div style={{ background: "rgba(255,255,255,0.78)", flex: 1, height: "60%", borderRadius: "4px 4px 2px 2px" }} />
        <div style={{ background: "#ffffff", flex: 1, height: "88%", borderRadius: "4px 4px 2px 2px" }} />
      </div>
    </div>,
    { width: 180, height: 180 }
  )
}
