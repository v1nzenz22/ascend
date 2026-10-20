// Renders the ascend app icon: an oversized white Times New Roman "a",
// cropped by a flat mint tile and pressed in with an inner shadow, plus grain.
//
// Usage (from the repo root, macOS only, no dependencies):
//   swift design/scripts/render-icon.swift design/export
//
// Writes ascend-icon-1024.png (app icon, transparent corners),
// ascend-mark-512.png (the grainy "a" alone, transparent background) and
// ascend-icon-web-1024.png (full-bleed square for iOS and PWA icons).
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
let inkColor = srgb(0x151A1B)  // ink (mark)
let glyphColor = srgb(0xFFFFFF)  // the icon's "a"
let fontName = "TimesNewRomanPSMT"
// Grain is max +/- change per channel (0-255). The bare mint tile gets its own
// grain first (drawn before the "a", so the white glyph covers it), then a
// light per-pixel pass goes over everything, so the white "a" stays almost
// clean.
//
// Per-pixel grain averages out when the icon is scaled down to 60-180 px
// (each small pixel mixes ~6-17 big ones), so the mint looked flat on the
// home screen. The tile grain is therefore coarse: random values on a grid
// of `tileGrainCell` px, blended smoothly (bilinear) between grid points so
// it reads as soft grain, not as square mosaic blocks.
// 4 px keeps about 2.5x more texture than per-pixel grain at 64-180 px;
// strength 24 keeps the full-size mint calmer than the old per-pixel 30.
let tileGrainCell = 4
let tileGrainStrength: Double = 24
let grainStrength: Double = 16
let glyphInkHeight: CGFloat = 1080  // the tile is 824 px: the "a" overflows it
let glyphCenter = CGPoint(x: 480, y: 450)  // cropped so the "a" can only be guessed

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

/// Outline of a single glyph as a path, scaled so its ink is `height` tall and
/// centred on `center`.
func glyphPath(_ text: String, inkHeight height: CGFloat, center: CGPoint) -> CGPath {
  let font = CTFontCreateWithName(fontName as CFString, 1000, nil)
  var characters = Array(text.utf16)
  var glyphs = [CGGlyph](repeating: 0, count: characters.count)
  guard CTFontGetGlyphsForCharacters(font, &characters, &glyphs, characters.count),
    let raw = CTFontCreatePathForGlyph(font, glyphs[0], nil)
  else { fatalError("No outline for \(text) in \(fontName)") }
  let box = raw.boundingBoxOfPath
  let scale = height / box.height
  var transform = CGAffineTransform(translationX: center.x, y: center.y)
    .scaledBy(x: scale, y: scale)
    .translatedBy(x: -box.midX, y: -box.midY)
  return raw.copy(using: &transform)!
}

/// Fills `path` and adds an inner shadow along its top edge, so the shape
/// looks pressed into the surface.
func fillWithInnerShadow(_ path: CGPath, color: NSColor, in ctx: CGContext) {
  ctx.saveGState()
  ctx.addPath(path)
  ctx.setFillColor(color.cgColor)
  ctx.fillPath()
  ctx.restoreGState()

  // Clip to the shape, then fill everything *outside* it with a shadow-casting
  // colour. The fill itself is clipped away; only its shadow falls inside.
  ctx.saveGState()
  ctx.addPath(path)
  ctx.clip()
  ctx.setShadow(
    offset: CGSize(width: 0, height: -22), blur: 34,
    color: NSColor(srgbRed: 0.06, green: 0.2, blue: 0.2, alpha: 0.45).cgColor)
  let outside = CGMutablePath()
  outside.addRect(CGRect(x: -4096, y: -4096, width: 12288, height: 12288))
  outside.addPath(path)
  ctx.addPath(outside)
  ctx.setFillColor(NSColor.black.cgColor)
  ctx.fillPath(using: .evenOdd)
  ctx.restoreGState()
}

/// Adds monochrome film grain to every pixel that is not fully transparent.
func addGrain(to rep: NSBitmapImageRep, seed: UInt64, strength: Double = grainStrength) {
  guard let data = rep.bitmapData else { return }
  var random = SeededRandom(state: seed)
  let bytesPerRow = rep.bytesPerRow
  for y in 0..<rep.pixelsHigh {
    for x in 0..<rep.pixelsWide {
      let i = y * bytesPerRow + x * 4
      let alpha = data[i + 3]
      guard alpha > 0 else { continue }
      // Premultiplied colour: scale the noise by alpha so soft edges stay clean.
      let delta = random.grain() * strength * Double(alpha) / 255.0
      for c in 0..<3 {
        let value = Double(data[i + c]) + delta
        data[i + c] = UInt8(max(0, min(Double(alpha), value)))
      }
    }
  }
}

/// Adds coarse monochrome grain: one random value per `cell` x `cell` grid
/// point, bilinearly interpolated in between. Coarse grain survives scaling
/// down far better than per-pixel grain.
func addCoarseGrain(
  to rep: NSBitmapImageRep, seed: UInt64, cell: Int = tileGrainCell,
  strength: Double = tileGrainStrength
) {
  guard let data = rep.bitmapData else { return }
  var random = SeededRandom(state: seed)
  // One extra grid point per axis so every pixel has four neighbours.
  let gridW = rep.pixelsWide / cell + 2
  let gridH = rep.pixelsHigh / cell + 2
  var grid = [Double](repeating: 0, count: gridW * gridH)
  for i in 0..<grid.count { grid[i] = random.grain() }
  let bytesPerRow = rep.bytesPerRow
  for y in 0..<rep.pixelsHigh {
    let gy = y / cell
    let fy = Double(y % cell) / Double(cell)
    for x in 0..<rep.pixelsWide {
      let i = y * bytesPerRow + x * 4
      let alpha = data[i + 3]
      guard alpha > 0 else { continue }
      let gx = x / cell
      let fx = Double(x % cell) / Double(cell)
      let top = grid[gy * gridW + gx] * (1 - fx) + grid[gy * gridW + gx + 1] * fx
      let bottom = grid[(gy + 1) * gridW + gx] * (1 - fx) + grid[(gy + 1) * gridW + gx + 1] * fx
      let noise = top * (1 - fy) + bottom * fy
      // Premultiplied colour: scale the noise by alpha so soft edges stay clean.
      let delta = noise * strength * Double(alpha) / 255.0
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
  withContext(art) { _ in
    tileColor.setFill()
    tile.fill()
  }
  // Coarse grain on the bare tile first; the "a" drawn next hides it.
  addCoarseGrain(to: art, seed: 0xA5CE_0D11)
  withContext(art) { ctx in
    // The "a" is far larger than the tile and cropped by it, so it can only
    // be guessed from its curves. White, pressed in with an inner shadow.
    tile.addClip()
    let a = glyphPath("a", inkHeight: glyphInkHeight, center: glyphCenter)
    fillWithInnerShadow(a, color: glyphColor, in: ctx)
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

// MARK: - Web icon (1024 px, full-bleed square for iOS / PWA)

/// Same "a" at the same pixel position as the app icon, but the mint fills
/// the whole square: no margin, no rounded corners, no drop shadow, no
/// transparency. iOS fills transparent pixels with black and rounds the
/// corners itself, and maskable PWA icons must cover the full canvas (the
/// platform cuts the shape). Because the glyph is not rescaled, the maskable
/// safe zone (a centred circle with 80 % of the width, 819 px) shows about
/// what the 824 px macOS tile shows: the arch, the bowl and the stem.
func renderWebIcon() -> NSBitmapImageRep {
  let size = 1024
  let rep = makeBitmap(size)
  withContext(rep) { _ in
    tileColor.setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
  }
  addCoarseGrain(to: rep, seed: 0xA5CE_0D13)
  withContext(rep) { ctx in
    let a = glyphPath("a", inkHeight: glyphInkHeight, center: glyphCenter)
    fillWithInnerShadow(a, color: glyphColor, in: ctx)
  }
  addGrain(to: rep, seed: 0xA5CE_0D03)
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
  try writePNG(renderWebIcon(), to: outDir.appendingPathComponent("ascend-icon-web-1024.png"))
} catch {
  FileHandle.standardError.write("render-icon failed: \(error)\n".data(using: .utf8)!)
  exit(1)
}
