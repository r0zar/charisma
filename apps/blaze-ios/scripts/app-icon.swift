import AppKit
import ImageIO
import UniformTypeIdentifiers

// usage: app-icon <flame.svg> <out.png>: the flame centred on Dark · RPG "bg" (#0b0606), 1024×1024, opaque
let args = CommandLine.arguments
guard args.count == 3, let flame = NSImage(contentsOfFile: args[1]) else {
    FileHandle.standardError.write(Data("usage: app-icon <flame.svg> <out.png>\n".utf8))
    exit(1)
}
let size = 1024
let inset = Double(size) * 0.18
let box = CGRect(x: inset, y: inset, width: Double(size) - 2 * inset, height: Double(size) - 2 * inset)
guard let flameImage = flame.cgImage(forProposedRect: nil, context: nil, hints: [.ctm: AffineTransform(scale: box.width / flame.size.width)]),
      let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    FileHandle.standardError.write(Data("Couldn't render \(args[1])\n".utf8))
    exit(1)
}
context.setFillColor(CGColor(srgbRed: 0x0b / 255, green: 0x06 / 255, blue: 0x06 / 255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: size, height: size))
context.draw(flameImage, in: box)
guard let icon = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(destination, icon, nil)
guard CGImageDestinationFinalize(destination) else { exit(1) }
print("Wrote \(args[2]) (\(size)×\(size), opaque)")
