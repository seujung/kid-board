import SwiftUI
import KidBoardCore

/// 날씨 지역 화면입니다. 지역을 검색해 고르면 저장하고 날씨를 바로 다시 가져옵니다.
struct WeatherLocationView: View {
    @ObservedObject var store: BoardStore
    let weather: WeatherViewModel

    @State private var query: String
    @State private var results: [GeoPlace] = []
    @State private var status: Status = .idle
    @State private var search: Task<Void, Never>?

    enum Status: Equatable {
        case idle, searching, empty, failed, saved(String)
    }

    init(store: BoardStore, weather: WeatherViewModel, initialQuery: String = "") {
        self.store = store
        self.weather = weather
        _query = State(initialValue: initialQuery)
    }

    static func label(_ place: GeoPlace) -> String {
        guard let admin1 = place.admin1, !admin1.isEmpty, admin1 != place.name else { return place.name }
        return "\(place.name), \(admin1)"
    }

    var body: some View {
        List {
            Section("지금 지역") {
                Text(store.weatherLocation.map(Self.label) ?? "아직 정하지 않았어요")
                    .font(.system(size: 20, weight: .semibold))
            }
            Section {
                HStack {
                    TextField("지역 이름 (예: 성남)", text: $query)
                        .submitLabel(.search)
                        .onSubmit(runSearch)
                        .font(.system(size: 20))
                    Button("검색", action: runSearch)
                        .buttonStyle(.borderedProminent)
                        .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } header: {
                Text("지역 검색")
            } footer: {
                statusText
            }
            if !results.isEmpty {
                Section("검색 결과") {
                    ForEach(Array(results.enumerated()), id: \.offset) { _, place in
                        Button {
                            choose(place)
                        } label: {
                            HStack {
                                Text(Self.label(place)).foregroundStyle(Color.primary)
                                Spacer()
                                if store.weatherLocation == place {
                                    Image(systemName: "checkmark").foregroundStyle(Color.accentColor)
                                }
                            }
                            .font(.system(size: 20))
                        }
                    }
                }
            }
        }
        .navigationTitle(ParentScreen.weather.title)
        .onAppear { if !query.isEmpty && results.isEmpty { runSearch() } }
        .onDisappear { search?.cancel() }
    }

    @ViewBuilder
    private var statusText: some View {
        switch status {
        case .idle: EmptyView()
        case .searching: Text("찾는 중이에요…")
        case .empty: Text("검색 결과가 없어요. 다른 이름으로 찾아 주세요.")
        case .failed: Text("검색하지 못했어요. 인터넷 연결을 확인해 주세요.").foregroundStyle(.red)
        case .saved(let name): Text("\(name)(으)로 바꿨어요. 날씨를 새로 가져와요.").foregroundStyle(.green)
        }
    }

    private func runSearch() {
        let text = query.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        search?.cancel()
        status = .searching
        search = Task {
            do {
                let found = try await weather.searchPlaces(text)
                guard !Task.isCancelled else { return }
                results = found
                status = found.isEmpty ? .empty : .idle
            } catch {
                guard !Task.isCancelled else { return }
                results = []
                status = .failed
            }
        }
    }

    private func choose(_ place: GeoPlace) {
        store.setWeatherLocation(place)
        weather.locationChanged()
        status = .saved(Self.label(place))
    }
}
