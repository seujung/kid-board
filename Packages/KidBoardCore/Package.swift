// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "KidBoardCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "KidBoardCore", targets: ["KidBoardCore"])
    ],
    targets: [
        .target(name: "KidBoardCore"),
        .testTarget(name: "KidBoardCoreTests", dependencies: ["KidBoardCore"])
    ],
    swiftLanguageModes: [.v6]
)
