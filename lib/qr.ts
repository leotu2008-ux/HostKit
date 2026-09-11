import QRCode from "qrcode";

/** An inline SVG QR code for a link — scanned at the door or off a poster. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#00000000" },
  });
}
