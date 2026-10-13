import Foundation

/// JSON over HTTPS. Every failure is a `WalletError` that names the service.
struct HTTP: Sendable {
    let session: URLSession

    func get<T: Decodable>(_ url: URL, from service: Service, as: T.Type = T.self) async throws -> T {
        try decode(try await send(URLRequest(url: url), to: service), from: service)
    }

    func post<T: Decodable>(_ url: URL, json: some Encodable, from service: Service, as: T.Type = T.self) async throws -> T {
        try decode(try await send(try Self.jsonRequest(url, json), to: service), from: service)
    }

    /// The body of a 2xx answer. Hiro rate limits (429) are waited out up to 3 times: its Retry-After (the 429 is the
    /// error when that's over 10 seconds), otherwise 1, 2 then 4 seconds.
    func send(_ request: URLRequest, to service: Service) async throws -> Data {
        let (data, response) = try await answer(request, from: service)
        guard (200..<300).contains(response.statusCode) else {
            // Service and status only: URLs carry the person's address
            Log.network.error("\(service.rawValue, privacy: .public) answered \(response.statusCode)")
            throw WalletError.requestFailed(service, status: response.statusCode)
        }
        return data
    }

    /// Any answer, with its status, for callers that read error bodies (broadcast, fee estimate)
    func answer(_ request: URLRequest, from service: Service) async throws -> (Data, HTTPURLResponse) {
        var request = request
        request.cachePolicy = .reloadIgnoringLocalCacheData
        var attempt = 0
        while true {
            let data: Data, response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                // SwiftUI cancels work it no longer needs (a tab or account switch): not a failure to show
                if Task.isCancelled { throw CancellationError() }
                Log.network.error("\(service.rawValue, privacy: .public): \(error.localizedDescription, privacy: .public)")
                throw WalletError.unreachable(service)
            }
            guard let http = response as? HTTPURLResponse else { throw WalletError.unreadable(service) }
            if http.statusCode == 429, service == .stacks, attempt < 3 {
                let retryAfter = http.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init)
                let wait = retryAfter.map { $0 > 0 ? $0 : 1 } ?? pow(2, Double(attempt))
                // A long Retry-After isn't worth waiting on: the 429 becomes the error
                guard wait <= 10 else { return (data, http) }
                try await Task.sleep(for: .seconds(wait))
                attempt += 1
                continue
            }
            return (data, http)
        }
    }

    func decode<T: Decodable>(_ data: Data, from service: Service, as: T.Type = T.self) throws -> T {
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            Log.network.error("\(service.rawValue, privacy: .public): unreadable answer: \(error, privacy: .public)")
            throw WalletError.unreadable(service)
        }
    }

    static func jsonRequest(_ url: URL, _ body: some Encodable) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            throw WalletError.unexpected(String(describing: error))
        }
        return request
    }
}
