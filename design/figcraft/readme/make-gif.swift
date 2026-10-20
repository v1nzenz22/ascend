// Builds an animated GIF from PNG frames with macOS ImageIO (no extra tools needed).
// Usage: swift make-gif.swift <out.gif> <frame1.png>:<seconds> [<frame2.png>:<seconds> ...]
// The GIF loops forever (loop count 0).
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = Array(CommandLine.arguments.dropFirst())
guard args.count >= 2 else {
    print("usage: swift make-gif.swift out.gif frame.png:0.1 ...")
    exit(1)
}
let outURL = URL(fileURLWithPath: args[0])
let frames = args.dropFirst().map { spec -> (String, Double) in
    // Split at the last ":" so paths with colons still work.
    let i = spec.lastIndex(of: ":")!
    return (String(spec[..<i]), Double(spec[spec.index(after: i)...]) ?? 0.1)
}
guard let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.gif.identifier as CFString,
                                                 frames.count, nil) else {
    print("cannot create \(outURL.path)")
    exit(1)
}
let fileProps = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary
CGImageDestinationSetProperties(dest, fileProps)
for (path, delay) in frames {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        print("cannot read \(path)")
        exit(1)
    }
    let props = [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay,
                                                 kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary
    CGImageDestinationAddImage(dest, img, props)
}
if !CGImageDestinationFinalize(dest) {
    print("could not write GIF")
    exit(1)
}
print("wrote \(outURL.path) (\(frames.count) frames)")
