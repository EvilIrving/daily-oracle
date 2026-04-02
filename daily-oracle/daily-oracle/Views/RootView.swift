//
//  RootView.swift
//  daily-oracle
//

import SwiftUI
import SwiftData

struct RootView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \DailyRecord.date, order: .reverse) private var records: [DailyRecord]
    @Query(sort: \Anniversary.date) private var anniversaries: [Anniversary]
    @Query private var configs: [UserConfig]

    var body: some View {
        NavigationStack {
            List {
                Section("今日数据") {
                    if let record = records.first {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(record.quoteText)
                                .font(.title3)
                            Text("\(record.quoteAuthor) \(record.quoteWork ?? "")")
                                .foregroundStyle(.secondary)
                            Text("宜：\(record.recommended.joined(separator: "、"))")
                            Text("忌：\(record.avoided.joined(separator: "、"))")
                        }
                    } else {
                        Text("还没有本地日签数据")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("本地存储状态") {
                    LabeledContent("DailyRecord", value: "\(records.count)")
                    LabeledContent("Anniversary", value: "\(anniversaries.count)")
                    LabeledContent("UserConfig", value: "\(configs.count)")
                }

                Section("验证") {
                    Button("写入示例数据") {
                        seedIfNeeded()
                    }
                }
            }
            .navigationTitle("日签")
        }
    }

    private func seedIfNeeded() {
        guard records.isEmpty, anniversaries.isEmpty, configs.isEmpty else { return }

        modelContext.insert(
            DailyRecord(
                date: .now,
                quoteText: "凌晨之前把今天放下，明天才有地方落下新的光。",
                quoteAuthor: "每日神谕",
                recommended: ["散步", "写字"],
                avoided: ["分心"],
                mood: .calm
            )
        )
        modelContext.insert(
            Anniversary(
                title: "纪念日示例",
                date: .now.addingTimeInterval(86_400 * 30)
            )
        )
        modelContext.insert(UserConfig())

        try? modelContext.save()
    }
}

#Preview {
    RootView()
        .modelContainer(OracleModelContainer.previewContainer())
}
