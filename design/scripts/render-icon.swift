// Renders the ascend app icon: a large lowercase Times New Roman "a" in ink
// on a flat mint tile, with film grain. No gradients.
//
// Usage (from the repo root, macOS only, no dependencies):
//   swift design/scripts/render-icon.swift design/export
//
// Writes ascend-icon-1024.png (app icon, transparent corners) and
// ascend-mark-512.png (the grainy "a" alone, transparent background).
// The grain uses a fixed seed, so every run produces identical pixels.

import AppKit
import CoreText

// MARK: - Design parameters (keep in sync with design/tokens.json)

func srgb(_ hex: UInt32) -> NSColor {
  NSColor(
    srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
    blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
}

let tileColor = srgb(0xA8DCD2)  // mint
let inkColor = srgb(0x151A1B)  // ink
let fontName = "TimesNewRomanPSMT"
let grainStrength: Double = 16  // max +/- change per channel (0-255)

// MARK: - Helpers

/// Small deterministic random generator (xorshift64*), so the grain is reproducible.
struct SeededRandom {
  var state: UInt64
  mutating func next() -> UInt64 {
    state ^= state >> 12
    state ^= state << 25
    state ^= state >> 27
    return state &* 2_685_821_657_736_338_717
  }
  /// Roughly Gaussian value in [-1, 1] (average of uniform samples).
  mutating func grain() -> Double {
    var sum = 0.0
    for _ in 0..<3 { sum += Double(next() % 10_000) / 10_000.0 }
    return (sum / 3.0) * 2.0 - 1.0
  }
}

func makeBitmap(_ size: Int) -> NSBitmapImageRep {
  NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
}

/// Draws a glyph so that its visible ink (not its line box) fills `height`
/// and is centred on `center`. Returns the ink rectangle that was drawn.
@discardableResult
func drawGlyph(
  _ text: String, inkHeight height: CGFloat, color: NSColor, center: CGPoint, in ctx: CGContext
) -> CGRect {
  guard let probe = NSFont(name: fontName, size: 100) else {
    fatalError("Font \(fontName) is not installed")
  }
  // Measure at 100 pt, then scale the font so the ink is exactly `height` tall.
  func line(_ font: NSFont) -> CTLine {
    CTLineCreateWithAttributedString(
      NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: color]))
  }
  let probeInk = CTLineGetImageBounds(line(probe), ctx)
  let font = NSFont(name: fontName, size: 100 * height / probeInk.height)!
  let finalLine = line(font)
  let ink = CTLineGetImageBounds(finalLine, ctx)
  ctx.textPosition = CGPoint(x: center.x - ink.midX, y: center.y - ink.midY)
  CTLineDraw(finalLine, ctx)
  return ink.offsetBy(dx: center.x - ink.midX, dy: center.y - ink.midY)
}

/// Adds monochrome film grain to every pixel that is not fully transparent.
func addGrain(to rep: NSBitmapImageRep, seed: UInt64) {
  guard let data = rep.bitmapData else { return }
  var random = SeededRandom(state: seed)
  let bytesPerRow = rep.bytesPerRow
  for y in 0..<rep.pixelsHigh {
    for x in 0..<rep.pixelsWide {
      let i = y * bytesPerRow + x * 4
      let alpha = data[i + 3]
      guard alpha > 0 else { continue }
      // Premultiplied colour: scale the noise by alpha so soft edges stay clean.
      let delta = random.grain() * grainStrength * Double(alpha) / 255.0
      for c in 0..<3 {
        let value = Double(data[i + c]) + delta
        data[i + c] = UInt8(max(0, min(Double(alpha), value)))
      }
    }
  }
}

func writePNG(_ rep: NSBitmapImageRep, to url: URL) throws {
  guard let png = rep.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "render-icon", code: 1)
  }
  try png.write(to: url)
  print("wrote \(url.path)")
}

func withContext(_ rep: NSBitmapImageRep, _ draw: (CGContext) -> Void) {
  NSGraphicsContext.saveGraphicsState()
  let nsContext = NSGraphicsContext(bitmapImageRep: rep)!
  NSGraphicsContext.current = nsContext
  draw(nsContext.cgContext)
  nsContext.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()
}

// MARK: - App icon (1024 px, macOS Big Sur grid: 824 px tile, 100 px margin)

func renderIcon() -> NSBitmapImageRep {
  let tileRect = NSRect(x: 100, y: 100, width: 824, height: 824)
  let tile = NSBezierPath(roundedRect: tileRect, xRadius: 185, yRadius: 185)

  // Tile and glyph on their own layer, so the grain never touches the shadow.
  let art = makeBitmap(1024)
  withContext(art) { ctx in
    tileColor.setFill()
    tile.fill()
    // The "a" is the icon: its ink is ~60 % of the tile height. Optically
    // centred a little above the geometric centre.
    tile.addClip()
    drawGlyph("a", inkHeight: 500, color: inkColor, center: CGPoint(x: 512, y: 522), in: ctx)
  }
  addGrain(to: art, seed: 0xA5CE_0D01)

  let rep = makeBitmap(1024)
  withContext(rep) { _ in
    // A soft, neutral drop shadow like the system icons; no colour, no gradient.
    let shadow = NSShadow()
    shadow.shadowOffset = NSSize(width: 0, height: -10)
    shadow.shadowBlurRadius = 24
    shadow.shadowColor = NSColor(white: 0, alpha: 0.22)
    NSGraphicsContext.saveGraphicsState()
    shadow.set()
    tileColor.setFill()
    tile.fill()
    NSGraphicsContext.restoreGraphicsState()
    art.draw(in: NSRect(x: 0, y: 0, width: 1024, height: 1024))
  }
  return rep
}

// MARK: - Mark (512 px, the "a" alone)

func renderMark() -> NSBitmapImageRep {
  let rep = makeBitmap(512)
  withContext(rep) { ctx in
    drawGlyph("a", inkHeight: 400, color: inkColor, center: CGPoint(x: 256, y: 256), in: ctx)
  }
  addGrain(to: rep, seed: 0xA5CE_0D02)
  return rep
}

// MARK: - Main

let outDir = URL(
  fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".",
  isDirectory: true)
do {
  try writePNG(renderIcon(), to: outDir.appendingPathComponent("ascend-icon-1024.png"))
  try writePNG(renderMark(), to: outDir.appendingPathComponent("ascend-mark-512.png"))
} catch {
  FileHandle.standardError.write("render-icon failed: \(error)\n".data(using: .utf8)!)
  exit(1)
}
