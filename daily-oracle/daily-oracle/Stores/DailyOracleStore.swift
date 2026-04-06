//
//  DailyOracleStore.swift
//  daily-oracle
//

import Foundation
import Observation
import SwiftData
import OSLog

@MainActor
@Observable
final class DailyOracleStore {
    private(set) var isLoading = false
    private(set) var lastErrorMessage: String?
    private(set) var lastResponseDate: Date?

    private let edgeService: any EdgeFunctionServicing

    init(
        edgeService: any EdgeFunctionServicing
    ) {
        self.edgeService = edgeService
    }

    func refresh(using modelContext: ModelContext, config: UserConfig?) async {
        isLoading = true
        lastErrorMessage = nil
        defer { isLoading = false }

        Log.store.info("Refresh started")
        do {
            let request = makeRequest(config: config, modelContext: modelContext)
            let response = try await edgeService.fetchDailyOracle(request: request)

            try upsertDailyRecord(with: response, modelContext: modelContext)

            if let config {
                config.lastSyncedAt = .now
            } else {
                modelContext.insert(UserConfig(lastSyncedAt: .now))
            }

            try modelContext.save()
            lastResponseDate = oracleDate(from: response.date)
            Log.store.info("Refresh completed for \(response.date, privacy: .public)")
        } catch {
            Log.store.error("Refresh failed: \(error.localizedDescription, privacy: .public)")
            lastErrorMessage = error.localizedDescription
        }
    }

    private func makeRequest(config: UserConfig?, modelContext: ModelContext) -> OracleEdgeRequest {
        let anniversary = todayAnniversary(from: modelContext)
        let prompt = buildAlmanacPrompt(anniversary: anniversary)

        return OracleEdgeRequest(
            prompt: prompt,
            geo: nil,
            weather: nil,
            profile: .init(
                lang: Locale.preferredLanguages.first?.prefix(2).description ?? "zh",
                region: Locale.current.region?.identifier ?? "CN",
                pro: false
            ),
            preferences: .init(
                mood: nil,
                moodHistory: [],
                anniversary: anniversary
            )
        )
    }

    private func buildAlmanacPrompt(anniversary: OracleEdgeRequest.Preferences.AnniversaryItem?) -> String {
        // 系统风格定义（固定部分）
        let systemPrompt = """
你是一个日常宜忌生成助手。

你的任务是生成今日宜忌各一条。

风格要求：
- 写具体的动作或状态，不写抽象建议（"宜散步"不够，"宜走一段没走过的路"才对）
- 不说教，不励志，语气像朋友随口说的，不像格言
- 宜和忌要有内在张力，像是同一个人今天的两面

正面示例：
在自然光下读几页纸质书
把休息当成需要被证明才能拥有的东西

出门走一段不常走的路，看陌生的窗口
用沉默代替真正想说的话

反面示例（排除）：
保持积极心态 ← 空话
不要生气 ← 说教

宜嫁娶 ← 古代的宜忌
忌出行 ← 古代的宜忌

严格按以下 JSON 格式输出，不加任何解释：
{"yi": "...", "ji": "..."}
"""

        // 输入信号（动态部分）
        let now = Date()
        let calendar = Calendar.oracle
        let month = calendar.component(.month, from: now)
        let day = calendar.component(.day, from: now)
        let weekday = calendar.component(.weekday, from: now)
        let weekdays = ["日", "一", "二", "三", "四", "五", "六"]

        var inputSignals = ""
        inputSignals += "今天的输入信号：\n"
        inputSignals += "- 日期：\(month)月\(day)日 星期\(weekdays[weekday - 1])\n"
        inputSignals += "- 节气：null\n"

        if let ann = anniversary {
            inputSignals += "- 纪念日：\(ann.name)\n"
        }

        inputSignals += "- 过去7天心情记录：[]\n"
        inputSignals += "\n请生成今日宜忌各一条。"

        return systemPrompt + "\n\n" + inputSignals
    }

    private func todayAnniversary(from modelContext: ModelContext) -> OracleEdgeRequest.Preferences.AnniversaryItem? {
        let descriptor = FetchDescriptor<Anniversary>()

        do {
            let todayMonth = Calendar.oracle.component(.month, from: .now)
            let todayDay = Calendar.oracle.component(.day, from: .now)

            let matches = try modelContext.fetch(descriptor).filter { anniversary in
                Calendar.oracle.component(.month, from: anniversary.date) == todayMonth &&
                Calendar.oracle.component(.day, from: anniversary.date) == todayDay
            }

            guard matches.count <= 1 else {
                Log.store.error("Found duplicate anniversaries for today: \(matches.count, privacy: .public)")
                return nil
            }

            guard let anniversary = matches.first else {
                return nil
            }

            let components = Calendar.oracle.dateComponents([.month, .day], from: anniversary.date)
            return OracleEdgeRequest.Preferences.AnniversaryItem(
                name: anniversary.title,
                month: components.month ?? 1,
                day: components.day ?? 1
            )
        } catch {
            Log.store.error("Failed to load anniversary: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func upsertDailyRecord(with response: OracleEdgeResponse, modelContext: ModelContext) throws {
        let date = oracleDate(from: response.date)
        let descriptor = FetchDescriptor<DailyRecord>(
            predicate: #Predicate<DailyRecord> { record in
                record.date == date
            }
        )
        let existing = try modelContext.fetch(descriptor).first
        let quote = response.quote

        let quoteText = quote.text
        let quoteAuthor = quote.author ?? ""
        let recommended = response.almanac.yi
        let avoided = response.almanac.ji

        if let existing {
            existing.quoteText = quoteText
            existing.quoteAuthor = quoteAuthor
            existing.quoteWork = quote.work
            existing.recommended = recommended
            existing.avoided = avoided
            existing.updatedAt = .now
        } else {
            modelContext.insert(
                DailyRecord(
                    date: date,
                    quoteText: quoteText,
                    quoteAuthor: quoteAuthor,
                    quoteWork: quote.work,
                    recommended: recommended,
                    avoided: avoided
                )
            )
        }
    }

    private func oracleDate(from value: String) -> Date {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value).map { Calendar.oracle.startOfDay(for: $0) } ?? Calendar.oracle.startOfDay(for: .now)
    }
}
