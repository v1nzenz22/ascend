// Renders the ascend app icon: a small lowercase Times New Roman "a" on a
// mint-to-blue tile with film grain.
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

let gradientStops: [(color: NSColor, location: CGFloat)] = [
  (NSColor(srgbRed: 0x9B / 255, green: 0xE8 / 255, blue: 0xCF / 255, alpha: 1), 0.0),  // mint
  (NSColor(srgbRed: 0x5C / 255, green: 0xC4 / 255, blue: 0xCF / 255, alpha: 1), 0.55),  // teal
  (NSColor(srgbRed: 0x3A / 255, green: 0x82 / 255, blue: 0xD6 / 255, alpha: 1), 1.0),  // blue
]
let glyphColor = NSColor(srgbRed: 0xFB / 255, green: 0xFA / 255, blue: 0xF6 / 255, alpha: 1)  // paper white
let markColor = NSColor(srgbRed: 0x1F / 255, green: 0x5F / 255, blue: 0x8E / 255, alpha: 1)  // deep teal-blue
let fontName = "TimesNewRomanPSMT"
let grainStrength: Double = 13  // max +/- change per channel (0-255)

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

/// Draws a single glyph centred on its visible ink (not on the line box).
func drawGlyph(_ text: String, size: CGFloat, color: NSColor, center: CGPoint, in ctx: CGContext) {
  guard let font = NSFont(name: fontName, size: size) else {
    fatalError("Font \(fontName) is not installed")
  }
  let attributed = NSAttributedString(
    string: text, attributes: [.font: font, .foregroundColor: color])
  let line = CTLineCreateWithAttributedString(attributed)
  let ink = CTLineGetImageBounds(line, ctx)
  ctx.textPosition = CGPoint(x: center.x - ink.midX, y: center.y - ink.midY)
  CTLineDraw(line, ctx)
}

/// Adds monochrome film grain to every pixel whose alpha is at least `minAlpha`.
func addGrain(to rep: NSBitmapImageRep, minAlpha: UInt8, seed: UInt64) {
  guard let data = rep.bitmapData else { return }
  var random = SeededRandom(state: seed)
  let bytesPerRow = rep.bytesPerRow
  for y in 0..<rep.pixelsHigh {
    for x in 0..<rep.pixelsWide {
      let i = y * bytesPerRow + x * 4
      let alpha = data[i + 3]
      guard alpha >= minAlpha else { continue }
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
  let rep = makeBitmap(1024)
  let tileRect = NSRect(x: 100, y: 100, width: 824, height: 824)
  let tile = NSBezierPath(roundedRect: tileRect, xRadius: 185, yRadius: 185)

  // Tile, glyph and grain are drawn on their own layer first, so the grain
  // never touches the drop shadow added afterwards.
  let art = makeBitmap(1024)
  withContext(art) { ctx in
    let gradient = NSGradient(
      colors: gradientStops.map(\.color),
      atLocations: gradientStops.map(\.location),
      colorSpace: .sRGB)!
    gradient.draw(in: tile, angle: -50)
    // A lowercase "a" set fairly small: about a third of the tile height.
    drawGlyph("a", size: 470, color: glyphColor, center: CGPoint(x: 512, y: 500), in: ctx)
  }
  addGrain(to: art, minAlpha: 1, seed: 0xA5CE_0D01)

  withContext(rep) { ctx in
    let shadow = NSShadow()
    shadow.shadowOffset = NSSize(width: 0, height: -12)
    shadow.shadowBlurRadius = 28
    shadow.shadowColor = NSColor(srgbRed: 0.05, green: 0.08, blue: 0.1, alpha: 0.28)
    NSGraphicsContext.saveGraphicsState()
    shadow.set()
    NSColor.black.setFill()
    tile.fill()
    NSGraphicsContext.restoreGraphicsState()
    art.draw(in: NSRect(x: 0, y: 0, width: 1024, height: 1024))
    _ = ctx
  }
  return rep
}

// MARK: - Mark (512 px, the "a" alone)

func renderMark() -> NSBitmapImageRep {
  let rep = makeBitmap(512)
  withContext(rep) { ctx in
    drawGlyph("a", size: 520, color: markColor, center: CGPoint(x: 256, y: 256), in: ctx)
  }
  addGrain(to: rep, minAlpha: 1, seed: 0xA5CE_0D02)
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
