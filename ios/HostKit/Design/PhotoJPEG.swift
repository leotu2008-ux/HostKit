import PhotosUI
import SwiftUI

/// Turns a picked photo into a small JPEG for upload: longest edge 1600 px,
/// so HEICs from the camera roll arrive as plain JPEG under the 5 MB cap.
enum PhotoJPEG {
    static let contentType = "image/jpeg"

    static func data(from item: PhotosPickerItem, maxEdge: CGFloat = 1600) async throws -> Data? {
        guard let raw = try await item.loadTransferable(type: Data.self),
              let image = UIImage(data: raw) else { return nil }
        let longest = max(image.size.width, image.size.height)
        let scale = min(1, maxEdge / max(longest, 1))
        let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let small = await image.byPreparingThumbnail(ofSize: target) ?? image
        return small.jpegData(compressionQuality: 0.85)
    }
}
