import Foundation

public enum ProvisioningProfile {
    /// CMS 서명으로 감싼 프로파일에서 plist 구간을 잘라 생성일과 만료일을 읽습니다.
    public static func dates(from data: Data) -> (creation: Date, expiration: Date)? {
        guard let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex)
        else { return nil }
        let plistData = data.subdata(in: start.lowerBound..<end.upperBound)
        guard let object = try? PropertyListSerialization.propertyList(from: plistData, options: [], format: nil),
              let dict = object as? [String: Any],
              let creation = dict["CreationDate"] as? Date,
              let expiration = dict["ExpirationDate"] as? Date
        else { return nil }
        return (creation, expiration)
    }

    /// 남은 시간이 2일 이하이면 올림한 남은 일수를, 아니면 nil을 돌려줍니다.
    public static func warningDaysLeft(expiration: Date, now: Date) -> Int? {
        let remaining = expiration.timeIntervalSince(now)
        guard remaining <= 172_800 else { return nil }
        return Int(ceil(remaining / 86_400))
    }
}
