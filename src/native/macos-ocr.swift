import Foundation
import Vision
import ImageIO

guard CommandLine.arguments.count > 1 else {
    fputs("Missing image file path\n", stderr)
    exit(1)
}

let filePath = CommandLine.arguments[1]
let fileUrl = URL(fileURLWithPath: filePath)

guard let imageSource = CGImageSourceCreateWithURL(fileUrl as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
    fputs("Failed to load image: \(filePath)\n", stderr)
    exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
    let observations = request.results ?? []
    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
    print(lines.joined(separator: "\n"))
} catch {
    fputs("OCR failed: \(error.localizedDescription)\n", stderr)
    exit(3)
}
