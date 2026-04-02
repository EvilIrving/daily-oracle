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
    @State private var store = DailyOracleStore()

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
                            if let weatherSummary = record.weatherSummary {
                                Text(weatherSummary)
                                    .foregroundStyle(.secondary)
                            }
                            Text("宜：\(record.recommended.joined(separator: "、"))")
                            Text("忌：\(record.avoided.joined(separator: "、"))")
                        }
                    } else {
                        Text("还没有本地日签数据")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("同步状态") {
                    if store.isLoading {
                        LabeledContent("网络层", value: "同步中")
                    } else if let errorMessage = store.lastErrorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    } else if let lastResponseDate = store.lastResponseDate {
                        LabeledContent("最近同步", value: lastResponseDate.formatted(date: .abbreviated, time: .omitted))
                    } else {
                        Text("尚未触发网络同步")
                            .foregroundStyle(.secondary)
                    }
                }

                Section("本地存储状态") {
                    LabeledContent("DailyRecord", value: "\(records.count)")
                    LabeledContent("Anniversary", value: "\(anniversaries.count)")
                    LabeledContent("UserConfig", value: "\(configs.count)")
                }

                Section("验证") {
                    Button("执行 Phase 3 Mock 同步") {
                        Task {
                            await store.refresh(using: modelContext, config: configs.first)
                        }
                    }
                    .disabled(store.isLoading)

                    Button("写入本地占位数据") {
                        seedIfNeeded()
                    }
                }
            }
            .navigationTitle("日签")
            .task {
                guard records.isEmpty else { return }
                await store.refresh(using: modelContext, config: configs.first)
            }
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
